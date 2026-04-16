// ==========================================
// Google Apps Script: ย้ายรูป slip จาก Google Drive → Supabase Storage (slip-images)
// ==========================================
// 📌 ตั้งค่า Script Properties ก่อนใช้งาน:
//   TAG_WARN_APPS_SCRIPT_SECRET → ค่า secret เดียวกับที่ใช้ใน Supabase
// ==========================================
// วิธีใช้: รัน migrateSlipImages() — จะดึงแถวที่ slip_url เป็น Google Drive
//         แล้วดาวน์โหลดรูปผ่าน DriveApp แล้วส่ง binary ไปให้ Edge Function อัปโหลด
// ==========================================

var EDGE_URL = "https://itulsrbsluwdqwakldjs.supabase.co/functions/v1/upload-slip-image";
var SUPABASE_REST = "https://itulsrbsluwdqwakldjs.supabase.co/rest/v1";
var SECRET = PropertiesService.getScriptProperties().getProperty("TAG_WARN_APPS_SCRIPT_SECRET");
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0dWxzcmJzbHV3ZHF3YWtsZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDQzODcsImV4cCI6MjA4MjkyMDM4N30.tXoHuOfILzkX4TD2HWJ3dUg0ZHghTvr_HBA4tNsLNMg";

function migrateSlipImages() {
  if (!SECRET) {
    Logger.log("❌ ไม่พบ TAG_WARN_APPS_SCRIPT_SECRET ใน Script Properties");
    return;
  }

  // 1) ดึงแถวจาก trading_history ที่ slip_url เป็น Google Drive
  var rows = fetchDriveSlipRows("slip_url");
  Logger.log("พบ " + rows.length + " แถวที่ต้องย้ายรูป slip_url");

  var success = 0;
  var failed = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    try {
      var result = processSlipRow(row, "slip_url", row.slip_url);
      if (result) {
        success++;
        Logger.log("✅ [" + (i + 1) + "/" + rows.length + "] id=" + row.id + " → " + result);
      } else {
        failed++;
        Logger.log("⚠️ [" + (i + 1) + "/" + rows.length + "] id=" + row.id + " ข้ามไป");
      }
    } catch (err) {
      failed++;
      Logger.log("❌ [" + (i + 1) + "/" + rows.length + "] id=" + row.id + " Error: " + err.message);
    }
    Utilities.sleep(1000);
  }

  Logger.log("=== slip_url สรุป: สำเร็จ " + success + " / ล้มเหลว " + failed + " ===");

  // 2) ดึงแถวที่ slip_url_2 เป็น Google Drive
  var rows2 = fetchDriveSlipRows("slip_url_2");
  Logger.log("พบ " + rows2.length + " แถวที่ต้องย้ายรูป slip_url_2");

  var success2 = 0;
  var failed2 = 0;

  for (var j = 0; j < rows2.length; j++) {
    var row2 = rows2[j];
    try {
      var result2 = processSlipRow(row2, "slip_url_2", row2.slip_url_2);
      if (result2) {
        success2++;
        Logger.log("✅ [" + (j + 1) + "/" + rows2.length + "] id=" + row2.id + " slip_url_2 → " + result2);
      } else {
        failed2++;
      }
    } catch (err2) {
      failed2++;
      Logger.log("❌ [" + (j + 1) + "/" + rows2.length + "] id=" + row2.id + " Error: " + err2.message);
    }
    Utilities.sleep(1000);
  }

  Logger.log("=== slip_url_2 สรุป: สำเร็จ " + success2 + " / ล้มเหลว " + failed2 + " ===");
  Logger.log("=== รวมทั้งหมด: สำเร็จ " + (success + success2) + " / ล้มเหลว " + (failed + failed2) + " ===");
}

// ดึงแถวจาก trading_history ที่ field เป็น Google Drive (สูงสุด 20 แถว)
function fetchDriveSlipRows(field) {
  var url = SUPABASE_REST + "/trading_history?select=id," + field + "&or=(" + field + ".ilike.*drive.google.com*," + field + ".ilike.*googleusercontent*)&" + field + "=not.is.null&order=log_timestamp.asc&limit=20";

  var response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "apikey": ANON_KEY,
      "Authorization": "Bearer " + ANON_KEY,
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

// ประมวลผลแต่ละแถว
function processSlipRow(row, field, slipUrl) {
  if (!slipUrl) return null;

  // แยก file ID จากลิงก์ Google Drive
  var fileId = extractDriveFileId(slipUrl);
  if (!fileId) {
    Logger.log("  ไม่พบ file ID จาก: " + slipUrl);
    return null;
  }

  // ดาวน์โหลดไฟล์จาก Google Drive
  var blob = downloadFromDrive(fileId);
  if (!blob) {
    Logger.log("  ดาวน์โหลดจาก Drive ไม่ได้ fileId=" + fileId);
    return null;
  }

  // ส่งรูปไปให้ Edge Function อัปโหลดเข้า Supabase Storage
  var newUrl = uploadViaEdgeFunction(row.id, blob, field);
  return newUrl;
}

// ดาวน์โหลดจาก Google Drive ผ่าน DriveApp
function downloadFromDrive(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    return file.getBlob();
  } catch (e) {
    // Fallback: ลองดาวน์โหลดผ่าน URL
    try {
      var downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
      var response = UrlFetchApp.fetch(downloadUrl, {
        muteHttpExceptions: true,
        followRedirects: true
      });
      if (response.getResponseCode() === 200) {
        return response.getBlob();
      }
    } catch (e2) {
      Logger.log("  Fallback download failed: " + e2.message);
    }
    return null;
  }
}

// ส่งรูปผ่าน Edge Function (multipart/form-data)
function uploadViaEdgeFunction(rowId, blob, field) {
  var boundary = "----FormBoundary" + Utilities.getUuid().replace(/-/g, "");
  var contentType = blob.getContentType() || "image/jpeg";

  // สร้าง multipart body
  var payload = Utilities.newBlob("").getBytes();
  payload = payload.concat(
    Utilities.newBlob(
      "--" + boundary + "\r\n" +
      'Content-Disposition: form-data; name="row_id"\r\n\r\n' +
      rowId + "\r\n"
    ).getBytes()
  );
  payload = payload.concat(
    Utilities.newBlob(
      "--" + boundary + "\r\n" +
      'Content-Disposition: form-data; name="field"\r\n\r\n' +
      field + "\r\n"
    ).getBytes()
  );
  payload = payload.concat(
    Utilities.newBlob(
      "--" + boundary + "\r\n" +
      'Content-Disposition: form-data; name="file"; filename="slip.' + getExt(contentType) + '"\r\n' +
      "Content-Type: " + contentType + "\r\n\r\n"
    ).getBytes()
  );
  payload = payload.concat(blob.getBytes());
  payload = payload.concat(
    Utilities.newBlob("\r\n--" + boundary + "--\r\n").getBytes()
  );

  var response = UrlFetchApp.fetch(EDGE_URL, {
    method: "post",
    headers: {
      "x-tag-secret": SECRET
    },
    contentType: "multipart/form-data; boundary=" + boundary,
    payload: payload,
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code === 200) {
    var result = JSON.parse(response.getContentText());
    if (result.status === "success") {
      return result.url;
    }
  }

  Logger.log("  Upload failed HTTP " + code + ": " + response.getContentText().slice(0, 300));
  return null;
}

// แยก file ID จาก Google Drive URL
function extractDriveFileId(url) {
  if (!url) return null;
  var m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  var m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  var m3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return null;
}

function getExt(contentType) {
  var map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp"
  };
  return map[contentType] || "jpg";
}
