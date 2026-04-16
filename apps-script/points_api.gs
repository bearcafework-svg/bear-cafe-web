const DB_SHEET_NAME = "points_db";
const CODES_SHEET = "codes_db";
const REDEEM_LOG = "redeems_log";
const DEFAULT_CAP = 750;

const ROLE_CAPS = {
  "1144701122053951498": 1000,  
  "1211006403569786923": 1500,  
  "1144701288257433781": 2000,  
  "1144701473549201419": 2500,  
  "1211007323456274592": 3000,  
  "1211007327348592723": 4000,  
  "1144701644479676569": 5000,  
  "1211007334755864576": 6000,  
  "1144701834842361927": 7500,  
  "1211007331219804171": 9000,  
  "1144702027474149447": 10000, 
  "1211007338321023026": 12000  
};

function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  const userId = (e.parameter.userId || "").trim();
  const amount = Number(e.parameter.amount || 0);
  const roleIds = e.parameter.roles || "";

  if (!userId && !action.startsWith("admin_") && action !== "get") {
    return out_({ ok: false, error: "missing_userId" });
  }

  // --- Optimization 1: แยกคำสั่งที่ไม่ต้องเข้าคิว (Read-only) ออกมาทำงานก่อน ---
  if (action === "get") {
    if (!userId) return out_({ ok: false, error: "missing_userId" });
    return out_({ ok: true, userId, ...getPoints_(userId) });
  }
  if (action === "admin_list_codes") {
    return out_(listRedeemCodes_());
  }

  // --- ระบบ LockService สำหรับคำสั่งที่มีการแก้ไขข้อมูล (Write) ---
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // ลดเวลารอคิวสูงสุดเหลือ 10 วินาที 
  } catch (err) {
    return out_({ ok: false, error: "system_busy" });
  }

  try {
    switch (action) {
      case "check": 
        return out_({ ok: true, userId, ...checkAndTrim_(userId, roleIds) });

      case "add": 
        if (!Number.isFinite(amount) || amount <= 0) return out_({ ok: false, error: "invalid_amount" });
        return out_({ ok: true, userId, ...addPoints_(userId, amount, roleIds) });

      case "sub": 
        if (!Number.isFinite(amount) || amount <= 0) return out_({ ok: false, error: "invalid_amount" });
        return out_({ ok: true, userId, ...subPoints_(userId, amount) });

      case "set": 
        if (!Number.isFinite(amount) || amount <= 0) return out_({ ok: false, error: "invalid_amount" });
        
        let setMaxCap;
        if (roleIds && roleIds !== "") {
          setMaxCap = calculateMaxCap_(roleIds);
        } else {
          const currentData = getPoints_(userId);
          setMaxCap = Math.max(currentData.maxCap || DEFAULT_CAP, DEFAULT_CAP);
        }

        let finalSetPoints = amount;
        let setTrimmed = false;

        if (finalSetPoints > setMaxCap) {
          finalSetPoints = setMaxCap;
          setTrimmed = true;
        }

        setPoints_(userId, finalSetPoints, setMaxCap);

        return out_({ 
          ok: true, 
          userId: userId, 
          points: finalSetPoints,
          maxCap: setMaxCap,
          isTrimmed: setTrimmed,
          trimmedAmount: amount - finalSetPoints
        });

      case "redeem":
        const codeToRedeem = (e.parameter.code || "").trim();
        if (!userId || !codeToRedeem) return out_({ ok: false, error: "missing_params" });
        return out_(redeemCode_(userId, codeToRedeem));

      case "admin_upsert_code":
        return out_(upsertRedeemCode_(e.parameter));

      case "admin_toggle_code":
         return out_(toggleRedeemCode_(e.parameter.code, e.parameter.enabled));

      case "admin_delete_code":
        return out_(deleteRedeemCode_(e.parameter.code));

      default: 
        return out_({ ok: false, error: "unknown_action" });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) { return doGet(e); }

/* =========================
   CORE LOGIC: POINTS
========================= */
function getPoints_(userId) {
  const sh = getDbSheet_();
  const { row } = findUser_(sh, userId);
  
  if (row === -1) return { points: 0, maxCap: DEFAULT_CAP };
  const points = Number(sh.getRange(row, 2).getValue());
  const savedCap = Number(sh.getRange(row, 4).getValue()); 

  return { 
    points: Number.isFinite(points) ? points : 0, 
    maxCap: (savedCap >= DEFAULT_CAP) ? savedCap : DEFAULT_CAP 
  };
}

function addPoints_(userId, amount, roleIds) {
  const data = getPoints_(userId);
  const currentPoints = data.points;
  
  let maxCap;
  if (roleIds && roleIds !== "") {
    maxCap = calculateMaxCap_(roleIds);
  } else {
    maxCap = Math.max(data.maxCap || DEFAULT_CAP, DEFAULT_CAP);
  }

  let newPoints = currentPoints + amount;
  let isCapped = false;

  if (newPoints > maxCap) {
    newPoints = maxCap;
    isCapped = true;
  }

  setPoints_(userId, newPoints, maxCap);
  return {
    points: newPoints,
    added: newPoints - currentPoints,
    maxCap: maxCap,
    isCapped: isCapped
  };
}

function subPoints_(userId, amount) {
  const data = getPoints_(userId);
  const newPoints = data.points - amount;
  
  setPoints_(userId, newPoints, Math.max(data.maxCap || DEFAULT_CAP, DEFAULT_CAP));
  return {
    points: newPoints,
    removed: amount,
    maxCap: data.maxCap
  };
}

function checkAndTrim_(userId, roleIds) {
  const data = getPoints_(userId);
  const currentPoints = data.points;
  const maxCap = calculateMaxCap_(roleIds);
  let finalPoints = currentPoints;
  let isTrimmed = false;

  if (currentPoints > maxCap) {
    finalPoints = maxCap;
    isTrimmed = true;
  }

  setPoints_(userId, finalPoints, maxCap);

  return {
    points: finalPoints,
    maxCap: maxCap,
    isTrimmed: isTrimmed,
    trimmedAmount: currentPoints - finalPoints
  };
}

function setPoints_(userId, value, maxCap) {
  const sh = getDbSheet_();
  const now = new Date();
  const { row } = findUser_(sh, userId);
  
  const capToSave = Math.max(Number(maxCap) || DEFAULT_CAP, DEFAULT_CAP);
  if (row === -1) {
    sh.appendRow([userId, value, now, capToSave]);
  } else {
    // --- Optimization 2: รวบคำสั่งเขียนชีต 3 ช่องให้เสร็จในบรรทัดเดียว (เร็วกว่าเดิม 3 เท่า) ---
    sh.getRange(row, 2, 1, 3).setValues([[value, now, capToSave]]);
  }
  return value;
}

function calculateMaxCap_(roleIdsString) {
  if (!roleIdsString || roleIdsString == "" || roleIdsString == "500") {
    return DEFAULT_CAP;
  }

  let currentMax = DEFAULT_CAP;
  const inputStr = String(roleIdsString);
  for (const rId in ROLE_CAPS) {
    if (inputStr.indexOf(rId) !== -1) {
      if (ROLE_CAPS[rId] > currentMax) {
        currentMax = ROLE_CAPS[rId];
      }
    }
  }
  return currentMax;
}

/* =========================
   CORE LOGIC: REDEEM CODES
========================= */
function listRedeemCodes_() {
  const sh = getCodesSheet_();
  const data = sh.getDataRange().getValues();
  const codes = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    codes.push({
      code: row[0],
      rewardType: row[1],
      points: Number(row[2]),
      roleId: String(row[3]),
      roleName: String(row[4]),
      maxUses: Number(row[5]),
      usedCount: Number(row[6]),
      startAt: row[7],
      endAt: row[8],
      enabled: row[9] === true || row[9] === "true",
      note: row[10]
    });
  }
  return { ok: true, codes: codes };
}

function redeemCode_(userId, codeInput) {
  const codesSh = getCodesSheet_();
  const logSh = getRedeemLogSheet_();
  const now = new Date();
  const codeParams = codeInput.toUpperCase();
  
  const finder = codesSh.createTextFinder(codeParams).matchEntireCell(true).findNext();
  if (!finder) return { ok: false, error: "invalid_code" };
  
  const row = finder.getRow();
  const values = codesSh.getRange(row, 1, 1, 11).getValues()[0];
  
  const codeData = {
    code: values[0],
    rewardType: values[1],
    points: Number(values[2]),
    roleId: values[3],
    maxUses: Number(values[5]),
    usedCount: Number(values[6]),
    startAt: values[7] ? new Date(values[7]) : null,
    endAt: values[8] ? new Date(values[8]) : null,
    enabled: values[9] === true || values[9] === "true"
  };

  if (!codeData.enabled) return { ok: false, error: "disabled" };
  if (codeData.maxUses > 0 && codeData.usedCount >= codeData.maxUses) return { ok: false, error: "limit_reached" };
  if (codeData.startAt && now < codeData.startAt) return { ok: false, error: "not_started" };
  if (codeData.endAt && now > codeData.endAt) return { ok: false, error: "expired" };

  const logData = logSh.getDataRange().getValues();
  for (let i = 1; i < logData.length; i++) {
    if (String(logData[i][1]) === String(userId) && String(logData[i][2]) === codeParams && logData[i][3] === "success") {
      return { ok: false, error: "already_redeemed" };
    }
  }

  let granted = {};
  
  if (codeData.rewardType === 'points' || codeData.rewardType === 'both') {
    addPoints_(userId, codeData.points, ""); 
    granted.pointsAdded = codeData.points;
  }
  
  if (codeData.rewardType === 'role' || codeData.rewardType === 'both') {
    granted.roleGranted = codeData.roleId;
  }

  codesSh.getRange(row, 7).setValue(codeData.usedCount + 1);
  logSh.appendRow([now, userId, codeParams, "success", JSON.stringify(granted)]);

  const userPoints = getPoints_(userId);

  return { 
    ok: true, 
    userId: userId, 
    code: codeParams,
    granted: granted,
    pointsNow: userPoints.points
  };
}

function upsertRedeemCode_(params) {
  const sh = getCodesSheet_();
  const code = params.code.trim().toUpperCase();
  
  const finder = sh.createTextFinder(code).matchEntireCell(true).findNext();
  
  const rowData = [
    code,
    params.rewardType || 'points',
    Number(params.points) || 0,
    params.roleId || '',
    params.roleName || '',
    Number(params.maxUses) || 0,
    finder ? sh.getRange(finder.getRow(), 7).getValue() : 0, 
    params.startAt || '',
    params.endAt || '',
    params.enabled === 'true',
    params.note || ''
  ];

  if (finder) {
    sh.getRange(finder.getRow(), 1, 1, rowData.length).setValues([rowData]);
  } else {
    sh.appendRow(rowData);
  }
  
  return { ok: true };
}

function toggleRedeemCode_(code, enabledStr) {
  const sh = getCodesSheet_();
  const finder = sh.createTextFinder(code).matchEntireCell(true).findNext();
  if (!finder) return { ok: false, error: "not_found" };
  
  const isEnabled = enabledStr === 'true';
  sh.getRange(finder.getRow(), 10).setValue(isEnabled); 
  return { ok: true };
}

function deleteRedeemCode_(code) {
  const sh = getCodesSheet_();
  const finder = sh.createTextFinder(code).matchEntireCell(true).findNext();
  if (!finder) return { ok: false, error: "not_found" };
  
  sh.deleteRow(finder.getRow());
  return { ok: true };
}

/* =========================
   HELPERS
========================= */
function getDbSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(DB_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(DB_SHEET_NAME);
    sh.appendRow(["userId", "points", "updatedAt", "maxCap"]);
  }
  return sh;
}

function getCodesSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CODES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CODES_SHEET);
    sh.appendRow(["code", "rewardType", "points", "roleId", "roleName", "maxUses", "usedCount", "startAt", "endAt", "enabled", "note"]);
  }
  return sh;
}

function getRedeemLogSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(REDEEM_LOG);
  if (!sh) {
    sh = ss.insertSheet(REDEEM_LOG);
    sh.appendRow(["timestamp", "userId", "code", "result", "rewardDetails"]);
  }
  return sh;
}

function findUser_(sh, userId) {
  const finder = sh.createTextFinder(userId).matchEntireCell(true).findNext();
  if (!finder) return { row: -1 };
  return { row: finder.getRow() };
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
