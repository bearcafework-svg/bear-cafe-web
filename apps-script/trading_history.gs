// ==========================================
// ส่วนที่ 1: ระบบแจ้งเตือน Discord (ทำงานเมื่อมีคนกรอกฟอร์ม)
// ===========================================
function onFormSubmit(e) {
  const webhookURL = "https://discord.com/api/webhooks/1410538470253793331/O1fVU-YMsPrHJNZao3NjbHlkxoutDbh29YA26A2Fb-t6fRZOCrjTjLlESZ4lQKP5cTMA"; 

  const r = e.values;
  const timestampRaw = r[0]; // A เวลา
  // r[1] น่าจะเป็นอีเมลหรือข้อมูลอื่นๆ (ถ้ามี)
  const buyerId = r[2];      // C ไอดีผู้ใช้ (ผู้ดำเนินการ)
  const time = r[3];         // D วันทำรายการ
  const sellerId = r[4];     // E ไอดีผู้ซื้อ
  const count = r[5];        // F จำนวนเงิน
  const billType = r[6];     // G ประเภทบิล
  const products = r[7];     // H สินค้า
  const otherProduct = r[8]; // I สินค้าอื่น ๆ
  const billImages = r[9];   // J ภาพบิล

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

  // ---------- Thumbnail เงื่อนไข ----------
  let thumbnailUrl = "";
  if (billType === "ธนาคารทั่วไป") {
    thumbnailUrl = "https://cdn.discordapp.com/attachments/1144675871798591569/1410542166232531024/bank.png"; 
  } else if (billType === "ทรูมันนี่") {
    thumbnailUrl = "https://cdn.discordapp.com/attachments/1144675871798591569/1410542166664806510/truemoney.png"; 
  }

  // ---------- สินค้า ----------
  const productList = products && products.trim() !== "" ? products : "-";

  // ---------- สินค้าอื่น ๆ ----------
  const other = otherProduct && otherProduct.trim() !== "" ? otherProduct : "-";

  // ---------- แปลง Google Drive link ----------
  function convertDriveLink(url) {
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url; 
  }

  let imageUrl = null;
  if (billImages && billImages.trim() !== "") {
    let firstImage = billImages.split(",")[0].trim();
    imageUrl = convertDriveLink(firstImage);
  }

  // ---------- Description ----------
  const description = `
## <:Service:1395695113258274887>︲__\` มีการส่งบิลใหม่! \`__ 
<:line:1144701793989840997>
- __\`ผู้ดำเนินการ\`__: <@${buyerId}>  
- __\`ผู้ซื้อ\`__: <@${sellerId}> - \`${sellerId}\`
- __\`เวลา\`__: ${discordTimestamp}  
- __\`ยอดสั่งซื้อ\`__: ${count} บาท
- __\`ประเภทบิล\`__: ${billType}  
- __\`สินค้า\`__: ${productList}  
- __\`สินค้าอื่น ๆ\`__: ${other}
  `.trim();

  // ---------- Payload ----------
  const payload = {
    username: "⊹ ꒰ แจ้งเตือนบิลใหม่ ꒱ 💸",
    content: `<@${buyerId}> <@${sellerId}>`,
    embeds: [{
      description: description,
      color: 0xffdf8f,
      thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
      image: imageUrl ? { url: imageUrl } : undefined,
    }]
  };

  // ---------- ส่งไป Discord ----------
  UrlFetchApp.fetch(webhookURL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
} // <--- ปิด onFormSubmit ตรงนี้


// ==========================================
// ส่วนที่ 2: Web App API (สำหรับให้เว็บไซต์ดึงข้อมูล/จัดการ)
// ==========================================

// 1. ดึงข้อมูลบิล (GET)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById('1HBpd8wORH9Ox8230u3fak382KQ2KJjKspK1ZRMEi0W8'); 
    var sheetName = "ฟอร์ม"; 
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // เอา setHeader ออกแล้ว ใช้แค่นี้พอค่ะ
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) {
      // กรณีชีตว่างเปล่า มีแค่หัวข้อ
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var rows = data.slice(1); // ตัด Header แถวแรกออก

    var jsonResult = rows.map(function(row) {
      return {
        timestamp: row[0] || "",       
        buyerId: row[2] || "",         
        time: row[3] || "",            
        sellerId: row[4] || "",        
        count: row[5] || "",           
        billType: row[6] || "",        
        products: row[7] || "",        
        otherProduct: row[8] || "",    
        image: convertDriveLinkForApi(row[9]), 
        status: row[10] || ""          
      };
    });

    // กรองแถวที่ว่างหรือไม่มี buyerId ออก
    jsonResult = jsonResult.filter(function(item) {
      return item.buyerId && item.buyerId !== "";
    });

    // ส่งข้อมูลกลับไปแบบคลีนๆ เหมือนของระบบแท็กเตือน
    return ContentService.createTextOutput(JSON.stringify(jsonResult))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // ส่ง Error กลับไปให้เว็บเราอ่าน
    var errResponse = [{
      status: "error",
      message: error.toString(),
      buyerId: "-", sellerId: "-", timestamp: new Date().toISOString()
    }];
    return ContentService.createTextOutput(JSON.stringify(errResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// ฟังก์ชันเสริมสำหรับ Web API (แปลงรูปลงเว็บ)
// ==========================================
function convertDriveLinkForApi(url) {
  if (!url) return "";

  var fileId = null;
  // หา ID จากรูปแบบ ?id=xxxxx
  var matchIdParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam) {
    fileId = matchIdParam[1];
  } 
  // หา ID จากรูปแบบ /d/xxxxx/
  else {
    var matchSlash = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchSlash) {
      fileId = matchSlash[1];
    }
  }

  // แปลงให้เป็น Thumbnail โหลดเร็ว
  if (fileId) {
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";
  }

  return url;
}
