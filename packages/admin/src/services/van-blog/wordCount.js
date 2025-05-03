export function wordCount(Words) {
  let iTotal = 0;
  let eTotal = 0;

  for (let i = 0; i < Words.length; i++) {
    var c = Words.charAt(i);
    //基本汉字
    if (c.match(/[\u4e00-\u9fa5]/)) {
      iTotal++;
    }
    //基本汉字补充
    if (c.match(/[\u9FA6-\u9fcb]/)) {
      iTotal++;
    }
    //  中文标点加中文字 (using Unicode ranges instead of control characters)
    if (c.charCodeAt(0) > 255) {
      // Chinese characters already counted above
    } else {
      // 英文
      eTotal++;
    }
    // 数字
    // if (c.match(/[0-9]/)) {
    //   inum++;
    // }
  }
  return iTotal + eTotal;
}
