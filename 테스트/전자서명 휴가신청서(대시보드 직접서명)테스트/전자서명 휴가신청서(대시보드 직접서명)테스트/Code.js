function saveSignature(dataUrl, row, role) {
  Logger.log(
    '[saveSignature] row: ' +
      row +
      ', role: ' +
      role +
      ', dataUrl: ' +
      (dataUrl ? dataUrl.substring(0, 30) : 'null')
  );
  const blob = Utilities.newBlob(
    Utilities.base64Decode(dataUrl.split(',')[1]),
    'image/png',
    'sig.png'
  );
  // 역할별 이름 가져오기
  let name;
  if (role === 'leader') {
    name = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim(); // L열
  } else if (role === 'reviewer') {
    name = data().getRange(row, CFG.COL.REVIEWER).getDisplayValue().trim(); // N열
  } else if (role === 'ceo') {
    name = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // P열
  } else {
    name = data().getRange(row, 2).getDisplayValue().trim(); // fallback
  }
  // 파일명: 이름_역할.png
  const fileName = `${name}_${role}.png`;
  const folder = DriveApp.getFolderById(CFG.SIGN_FOLDER);
  // 기존 파일 삭제(덮어쓰기)
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    const oldFile = files.next();
    oldFile.setTrashed(true); // 휴지통으로 이동
  }
  // 새 파일 저장
  const file = folder.createFile(blob);
  file.setName(fileName);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
  const col =
    role === 'leader'
      ? CFG.COL.LEADER_SIG
      : role === 'reviewer'
      ? CFG.COL.REVIEWER_SIG
      : CFG.COL.CEO_SIG;
  Logger.log(
    `[saveSignature] setFormula target row: ${row}, col: ${col}, role: ${role}, url: ${url}`
  );
  data().getRange(row, col).setFormula(`=IMAGE("${url}")`);
  Logger.log(`[saveSignature] setFormula DONE row: ${row}, col: ${col}, role: ${role}`);

  if (role === 'leader') {
    data()
      .getRange(row, CFG.COL.REVIEWER)
      .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 6, FALSE),"")`);
    SpreadsheetApp.flush();
    const nextName = data().getRange(row, CFG.COL.REVIEWER).getDisplayValue().trim();
    const info = lookupBoardByName(nextName);
    if (info) pushToBoard(info.boardId, 'reviewer', row, getPersonalSheetUrl(row));
  } else if (role === 'reviewer') {
    data()
      .getRange(row, CFG.COL.CEO)
      .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 7, FALSE),"")`);
    SpreadsheetApp.flush();
    const nextName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
    const info = lookupBoardByName(nextName);
    if (info) pushToBoard(info.boardId, 'ceo', row, getPersonalSheetUrl(row));
  } else if (role === 'ceo') {
    updateRowInCalendar(data(), row);
    exportPdfAndNotify(row);
  }
}
