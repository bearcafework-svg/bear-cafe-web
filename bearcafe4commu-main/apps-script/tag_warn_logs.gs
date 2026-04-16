// ==========================================
// ส่วนที่ 1: ระบบแจ้งเตือน Discord (ทำงานเมื่อมีคนกรอกฟอร์ม)
// ==========================================
function onFormSubmit(e) {
  const webhookURL = "https://discord.com/api/webhooks/1438715792362569820/FE5hvcrW3OATp-3dRr4LoMlBYQrUIsLs2r_jv4CXKNe7b7PrjD1kr-8K5U0lJrsTHvQW";
  // ------------------------------------

  const r = e.values;
  const timestampRaw = r[0];  
  const baristaId = r[2];     
  const memberId = r[3];    
  const message = r[4];       
  const punish = r[5];       
  const punishLink = r[6];   
  const warnImages = r[7]; 

  // ---------- Timestamp ----------
  function parseTimestampTH(raw) {
    const parts = raw.split(" ");
    const date = parts[0].split("/");
    const time = parts[1].split(":");

    const day = parseInt(date[0], 10);
    const month = parseInt(date[1], 10) - 1;
    const year = parseInt(date[2], 10);
    const hour = parseInt(time[0], 10);
    const minute = parseInt(time[1], 10);
    const second = parseInt(time[2], 10);

    return new Date(year, month, day, hour, minute, second);
  }

  const dateObj = parseTimestampTH(timestampRaw);
  const unixTimestamp = Math.floor(dateObj.getTime() / 1000);
  const discordTimestamp = `<t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;

  // ---------- Convert Google Drive ----------
  function convertDriveLink(url) {
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
  }

  let imageUrl = null;
  if (warnImages && warnImages.trim() !== "") {
    let firstImage = warnImages.split(",")[0].trim();
    imageUrl = convertDriveLink(firstImage);
  }

  // ---------- Description ----------
  const description = `
## <a:bearg22:1396016006572412998>︲__\` แท็กเตือนจากบาริสต้า! \`__
<:line:1144701793989840997>
- __\`แท็ก\`__: <@${memberId}> — \`${memberId}\`
- __\`เวลา\`__: ${discordTimestamp}
- __\`บทลงโทษ\`__: **${punish}**
- __\`ลิงก์ลงโทษ\`__: [คลิกฉันสิ](${punishLink})
### ${message}
`.trim();

  // ---------- Payload ----------
  const payload = {
    username: "⊹ ꒰ แท็กเตือนจากบาริสต้า ꒱ 🚫",
    content: `<@${memberId}>`,
    embeds: [{
      description: description,
      color: 0xFFEFEF,
      image: imageUrl ? { url: imageUrl } : undefined
    }]
  };

  // ✅ เปลี่ยนจาก UrlFetchApp ปกติ มาใช้ฟังก์ชันส่งแบบมีระบบรอเวลา (Retry)
  sendDiscordWebhookWithRetry(webhookURL, payload);

} 


// ==========================================
// ส่วนที่ 2: Web App API (สำหรับ Lovable / Web)
// ==========================================

function doGet(e) {
  var sheetName = "แท็กเตือน"; 
  // 💡 โน้ตเล็กๆ: ถ้าเว็บดึงข้อมูลไม่ขึ้นเพราะติด Permission 
  // อย่าลืมเปลี่ยนบรรทัดนี้เป็น SpreadsheetApp.openById("ID_ชีตของคุณ") นะคะ
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Sheet not found"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getDisplayValues();
  var rows = data.slice(1); 

  var jsonResult = rows.map(function(row) {
    return {
      timestamp: row[0],
      sequence: row[1],
      email: row[2],
      baristaId: row[3],
      memberId: row[4],
      warningMessage: row[5],
      punishment: row[6],
      punishmentLink: row[7],
      image: convertDriveLinkForApi(row[8]), 
      cancelStatus: row[9] 
    };
  });

  jsonResult = jsonResult.filter(function(item) {
    return item.memberId && item.memberId !== "";
  });

  return ContentService.createTextOutput(JSON.stringify(jsonResult))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheetName = "แท็กเตือน";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  try {
    var params = JSON.parse(e.postData.contents);
    var targetTimestamp = params.timestamp;
    var action = params.action;

    if (action === "cancel" && targetTimestamp) {
      var data = sheet.getDataRange().getDisplayValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === targetTimestamp) {
          sheet.getRange(i + 1, 10).setValue("ยกเลิกแล้ว (Cancelled)"); 
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Updated successfully"}))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Row not found"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function convertDriveLinkForApi(url) {
  if (!url) return "";
  var fileId = null;
  var matchIdParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam) {
    fileId = matchIdParam[1];
  } else {
    var matchSlash = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchSlash) {
      fileId = matchSlash[1];
    }
  }
  if (fileId) {
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";
  }
  return url;
}

// ==========================================
// ฟังก์ชันเสริม: ส่ง Webhook เข้า Discord พร้อมระบบแก้ Rate Limit
// ==========================================
function sendDiscordWebhookWithRetry(url, payload, maxRetries = 3) {
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // ปิด Error ไม่ให้สคริปต์พังเวลาโดนบล็อก
  };

  for (var i = 0; i < maxRetries; i++) {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200 || responseCode === 204) {
      return true; // ส่งผ่านแล้ว ออกจากลูปได้เลย
    } else if (responseCode === 429) {
      // โดนบล็อก (Rate Limit) -> เช็คว่าต้องรอกี่วิ แล้วสั่งให้สคริปต์หลับรอ
      var responseBody = JSON.parse(response.getContentText());
      var waitTimeMs = (responseBody.retry_after * 1000) || 1000; 
      Utilities.sleep(waitTimeMs + 100); 
    } else {
      return false; // Error อื่นๆ (เช่นลิงก์ผิด) ให้ข้ามไปเลย
    }
  }
  return false; 
}
