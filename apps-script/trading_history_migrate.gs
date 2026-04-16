// ==========================================
// Google Apps Script: ย้ายข้อมูลประวัติการซื้อขายจาก Google Sheets → Supabase (trading_history)
// ==========================================
// 📌 ตั้งค่า Script Properties ก่อนใช้งาน:
//   1. เปิด Apps Script Editor → Project Settings → Script Properties
//   2. เพิ่ม property ชื่อ TAG_WARN_APPS_SCRIPT_SECRET แล้วใส่ค่า secret เดียวกับที่อยู่ใน Supabase
// ==========================================

var EDGE_FUNCTION_URL = "https://itulsrbsluwdqwakldjs.supabase.co/functions/v1/trading-history-ingest";
var SECRET = PropertiesService.getScriptProperties().getProperty("TAG_WARN_APPS_SCRIPT_SECRET");
var SHEET_ID = "1HBpd8wORH9Ox8230u3fak382KQ2KJjKspK1ZRMEi0W8";
var SHEET_NAME = "ฟอร์ม";

function migrateAllTradingHistory() {
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
    Logger.log("❌ ไม่มีข้อมูล (มีแค่ Header)");
    return;
  }

  var rows = data.slice(1); // ตัด Header
  var success = 0;
  var failed = 0;
  var skipped = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var memberId = row[4]; // คอลัมน์ E - ไอดีผู้ซื้อ (member_id)

    // ข้ามแถวที่ไม่มี member_id
    if (!memberId || memberId.trim() === "") {
      skipped++;
      continue;
    }

    var logTimestamp = row[0] || "";   // คอลัมน์ A - เวลา
    var serviceId = row[2] || "";      // คอลัมน์ C - ผู้ดำเนินการ
    var transaction = row[3] || "";    // คอลัมน์ D - วันทำรายการ (dd/mm/yyyy)
    var amount = row[5] || "0";        // คอลัมน์ F - จำนวนเงิน
    var typeBill = row[6] || "";       // คอลัมน์ G - ประเภทบิล
    var item1 = row[7] || "";          // คอลัมน์ H - สินค้า
    var item2 = row[8] || "";          // คอลัมน์ I - สินค้าอื่นๆ

    // รวม item H + I
    var itemCombined = "";
    if (item1 && item1.trim() !== "" && item1 !== "-") itemCombined = item1.trim();
    if (item2 && item2.trim() !== "" && item2 !== "-") {
      itemCombined = itemCombined ? itemCombined + ", " + item2.trim() : item2.trim();
    }

    // แปลง amount เป็นตัวเลข
    var amountNum = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(amountNum)) amountNum = 0;

    var payload = {
      secret: SECRET,
      log_timestamp: logTimestamp,
      service_id: serviceId,
      transaction: transaction,
      member_id: memberId,
      amount: amountNum,
      type_bill: typeBill,
      item: itemCombined || null,
      slip_url: null  // ยังไม่ดึงภาพ จะใส่ทีหลัง
    };

    try {
      var response = UrlFetchApp.fetch(EDGE_FUNCTION_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      if (code === 200 || code === 201) {
        success++;
        if ((i + 1) % 50 === 0) {
          Logger.log("✅ [" + (i + 1) + "/" + rows.length + "] สำเร็จ " + success + " รายการ");
        }
      } else {
        failed++;
        Logger.log("❌ [" + (i + 1) + "] HTTP " + code + ": " + response.getContentText().slice(0, 200));
      }
    } catch (err) {
      failed++;
      Logger.log("❌ [" + (i + 1) + "] Error: " + err.message);
    }

    // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ถูก rate limit
    Utilities.sleep(200);
  }

  Logger.log("=== สรุป: สำเร็จ " + success + " / ล้มเหลว " + failed + " / ข้าม " + skipped + " ===");
}
