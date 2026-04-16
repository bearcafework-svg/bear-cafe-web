// ==========================================
// Google Apps Script: อัปเดต slip_url จากคอลัมน์ J → trading_history ผ่าน Edge Function
// ==========================================
// 📌 ตั้งค่า Script Properties:
//   TAG_WARN_APPS_SCRIPT_SECRET → ค่า secret เดียวกับที่ใช้ใน Supabase (ตัวเดิมที่มีอยู่แล้ว)
// ==========================================
var EDGE_URL = "https://itulsrbsluwdqwakldjs.supabase.co/functions/v1/trading-history-slip-update";
var SECRET = PropertiesService.getScriptProperties().getProperty("TAG_WARN_APPS_SCRIPT_SECRET");
var SHEET_ID = "1HBpd8wORH9Ox8230u3fak382KQ2KJjKspK1ZRMEi0W8";
var SHEET_NAME = "ฟอร์ม";

function updateAllSlipUrls() {
  if (!SECRET) {
    Logger.log("❌ ไม่พบ TAG_WARN_APPS_SCRIPT_SECRET ใน Script Properties");
    return;
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("❌ ไม่พบชีตชื่อ: " + SHEET_NAME);
    return;
  }

  var data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) {
    Logger.log("❌ ไม่มีข้อมูล");
    return;
  }

  var rows = data.slice(1);
  var success = 0;
  var failed = 0;
  var skipped = 0;
  var notFound = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var memberId = (row[4] || "").trim();   // คอลัมน์ E - member_id
    var transaction = (row[3] || "").trim(); // คอลัมน์ D - วันทำรายการ
    var slipUrl = (row[9] || "").trim();     // คอลัมน์ J - slip_url

    if (!memberId || !slipUrl) {
      skipped++;
      continue;
    }

    var payload = {
      secret: SECRET,
      member_id: memberId,
      transaction: transaction,
      slip_url: slipUrl
    };

    try {
      var response = UrlFetchApp.fetch(EDGE_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      if (code === 200) {
        var result = JSON.parse(response.getContentText());
        if (result.status === "updated") {
          success++;
        } else {
          notFound++;
        }
        if ((i + 1) % 50 === 0) {
          Logger.log("✅ [" + (i + 1) + "/" + rows.length + "] สำเร็จ " + success + " / ไม่พบ " + notFound);
        }
      } else {
        failed++;
        Logger.log("❌ [" + (i + 1) + "] HTTP " + code + ": " + response.getContentText().slice(0, 200));
      }
    } catch (err) {
      failed++;
      Logger.log("❌ [" + (i + 1) + "] Error: " + err.message);
    }

    Utilities.sleep(200);
  }

  Logger.log("=== สรุป: สำเร็จ " + success + " / ไม่พบ " + notFound + " / ล้มเหลว " + failed + " / ข้าม " + skipped + " ===");
}
