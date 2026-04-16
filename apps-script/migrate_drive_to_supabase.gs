// ==========================================
// Google Apps Script: ย้ายรูปจาก Google Drive → Supabase Storage (warn-images)
// ==========================================
// 📌 ตั้งค่า Script Properties ก่อนใช้งาน:
//   1. เปิด Apps Script Editor → Project Settings → Script Properties
//   2. เพิ่ม property ชื่อ SUPABASE_SERVICE_ROLE_KEY แล้วใส่ค่า service_role key
// =========================================

var SUPABASE_URL = "https://itulsrbsluwdqwakldjs.supabase.co";
var SUPABASE_KEY = PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_ROLE_KEY");
var BUCKET_NAME = "warn-images";

function migrateAllDriveImages() {
  if (!SUPABASE_KEY) {
    Logger.log("❌ ไม่พบ SUPABASE_SERVICE_ROLE_KEY ใน Script Properties");
    return;
  }

  // 1) ดึงข้อมูลจาก tag_warn_logs ที่ image_url ยังเป็นลิงก์ Google Drive
  var rows = fetchDriveRows();
  Logger.log("พบ " + rows.length + " แถวที่ต้องย้ายรูป");

  var success = 0;
  var failed = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    try {
      var newUrl = processRow(row);
      if (newUrl) {
        success++;
        Logger.log("✅ [" + (i + 1) + "/" + rows.length + "] id=" + row.id + " → " + newUrl);
      } else {
        failed++;
        Logger.log("⚠️ [" + (i + 1) + "/" + rows.length + "] id=" + row.id + " ข้ามไป (ไม่พบ file ID)");
      }
    } catch (err) {
      failed++;
      Logger.log("❌ [" + (i + 1) + "/" + rows.length + "] id=" + row.id + " Error: " + err.message);
    }

    // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ถูก rate limit
    Utilities.sleep(500);
  }

  Logger.log("=== สรุป: สำเร็จ " + success + " / ล้มเหลว " + failed + " ===");
}

// ดึงแถวจาก tag_warn_logs ที่ image_url เป็นลิงก์ Google Drive
function fetchDriveRows() {
  // ใช้ PostgREST API กรอง image_url ที่มีคำว่า "drive.google.com" หรือ "googleusercontent"
  var url = SUPABASE_URL + "/rest/v1/tag_warn_logs?select=id,image_url&or=(image_url.ilike.*drive.google.com*,image_url.ilike.*googleusercontent*)&image_url=not.is.null&order=sequence.asc";

  var response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    Logger.log("❌ ดึงข้อมูลล้มเหลว: " + response.getContentText());
    return [];
  }

  return JSON.parse(response.getContentText());
}

// ประมวลผลแต่ละแถว: ดาวน์โหลดจาก Drive → อัปโหลดเข้า Supabase → อัปเดต URL
function processRow(row) {
  var imageUrl = row.image_url;

  // แยก file ID จากลิงก์ Google Drive หลายรูปแบบ
  var fileId = extractFileId(imageUrl);
  if (!fileId) return null;

  // ดาวน์โหลดไฟล์จาก Google Drive
  var blob = downloadFromDrive(fileId);
  if (!blob) return null;

  // สร้างชื่อไฟล์ใหม่ (ใช้ row id + นามสกุลจาก content type)
  var ext = getExtension(blob.getContentType());
  var fileName = row.id + ext;

  // อัปโหลดเข้า Supabase Storage
  var publicUrl = uploadToSupabase(fileName, blob);
  if (!publicUrl) return null;

  // อัปเดต image_url ในฐานข้อมูล
  updateImageUrl(row.id, publicUrl);

  return publicUrl;
}

// แยก file ID จาก Google Drive URL หลายรูปแบบ
function extractFileId(url) {
  if (!url) return null;

  // รูปแบบ: /file/d/FILE_ID/
  var match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];

  // รูปแบบ: ?id=FILE_ID หรือ &id=FILE_ID
  var match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];

  // รูปแบบ: /open?id=FILE_ID
  var match3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (match3) return match3[1];

  return null;
}

// ดาวน์โหลดไฟล์จาก Google Drive โดยใช้ DriveApp
function downloadFromDrive(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    return file.getBlob();
  } catch (e) {
    // Fallback: ลองดาวน์โหลดผ่าน URL โดยตรง
    try {
      var downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
      var response = UrlFetchApp.fetch(downloadUrl, { muteHttpExceptions: true, followRedirects: true });
      if (response.getResponseCode() === 200) {
        return response.getBlob();
      }
    } catch (e2) {
      Logger.log("ดาวน์โหลดล้มเหลว fileId=" + fileId + ": " + e2.message);
    }
    return null;
  }
}

// อัปโหลดไฟล์เข้า Supabase Storage
function uploadToSupabase(fileName, blob) {
  var uploadUrl = SUPABASE_URL + "/storage/v1/object/" + BUCKET_NAME + "/" + fileName;

  var response = UrlFetchApp.fetch(uploadUrl, {
    method: "post",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": blob.getContentType() || "image/jpeg",
      "x-upsert": "true"  // เขียนทับถ้ามีไฟล์ชื่อซ้ำ
    },
    payload: blob.getBytes(),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code === 200 || code === 201) {
    // สร้าง Public URL
    return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET_NAME + "/" + fileName;
  } else {
    Logger.log("อัปโหลดล้มเหลว: " + response.getContentText());
    return null;
  }
}

// อัปเดต image_url ในตาราง tag_warn_logs
function updateImageUrl(rowId, newUrl) {
  var url = SUPABASE_URL + "/rest/v1/tag_warn_logs?id=eq." + rowId;

  var response = UrlFetchApp.fetch(url, {
    method: "patch",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    payload: JSON.stringify({ image_url: newUrl }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 204) {
    Logger.log("อัปเดต DB ล้มเหลว id=" + rowId + ": " + response.getContentText());
  }
}

// แปลง content type เป็นนามสกุลไฟล์
function getExtension(contentType) {
  var map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp"
  };
  return map[contentType] || ".jpg";
}
