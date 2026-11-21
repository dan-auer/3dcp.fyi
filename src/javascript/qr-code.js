/* qr-code.js - a QR code for a short text, as a matrix of modules. Written for
   kiosk mode (kiosk.js), which shows the short link of the work on screen
   (https://3dcp.fyi/<key>, 29 to 70 characters in the current data).

   window.OAQRCode(text, version?) -> rows of booleans (true = dark), size
   17 + 4 x the version, without the quiet zone; null when the text does not
   fit.

   Byte mode, error correction level M (still reads with 15% of it damaged),
   versions 1-6: up to 106 bytes. Versions 1-6 need no version information and
   have at most one alignment pattern, which keeps this short. The smallest
   version that fits is used, but never one below `version` when that is
   given (kiosk mode draws every link at one size); of the eight masks, the
   one with the lowest penalty score (ISO/IEC 18004, 7.8.3). No dependency. */
(function () {
  "use strict";

  // Level M per version: [error correction codewords per block, blocks, data
  // codewords per block]. All blocks of one version are the same length.
  var BLOCKS = [null, [10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27]];

  // Multiplication in GF(256) over x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
  function mul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  // Reed-Solomon: the generator polynomial of the given degree (highest power
  // first, its leading 1 left out), and the remainder of the data over it.
  function divisor(degree) {
    var out = [], root = 1, i, j;
    for (i = 0; i < degree - 1; i++) out.push(0);
    out.push(1);
    for (i = 0; i < degree; i++) {
      for (j = 0; j < out.length; j++) {
        out[j] = mul(out[j], root);
        if (j + 1 < out.length) out[j] ^= out[j + 1];
      }
      root = mul(root, 2);
    }
    return out;
  }
  function remainder(data, div) {
    var out = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ out.shift();
      out.push(0);
      div.forEach(function (c, i) { out[i] ^= mul(c, f); });
    });
    return out;
  }

  // The mask patterns, x the column and y the row.
  function flip(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  }

  // Penalty of a finished symbol: runs of five or more alike (3, +1 each
  // further module), 2 x 2 blocks alike (3), finder-like 1:1:3:1:1 runs with
  // four light modules beside them (40), and 10 for every 5% the dark share is
  // off one half.
  function penalty(g) {
    var n = g.length, p = 0, dark = 0, x, y;
    for (y = 0; y < n; y++) {
      var rowRun = 1, colRun = 1;
      for (x = 1; x < n; x++) {
        if (g[y][x] === g[y][x - 1]) { rowRun++; p += rowRun === 5 ? 3 : rowRun > 5 ? 1 : 0; } else rowRun = 1;
        if (g[x][y] === g[x - 1][y]) { colRun++; p += colRun === 5 ? 3 : colRun > 5 ? 1 : 0; } else colRun = 1;
      }
    }
    for (y = 0; y < n - 1; y++) {
      for (x = 0; x < n - 1; x++) {
        var c = g[y][x];
        if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) p += 3;
      }
    }
    var lines = [];
    for (y = 0; y < n; y++) {
      var row = "", col = "";
      for (x = 0; x < n; x++) { row += g[y][x] ? "1" : "0"; col += g[x][y] ? "1" : "0"; if (g[y][x]) dark++; }
      lines.push(row, col);
    }
    lines.forEach(function (s) {
      ["10111010000", "00001011101"].forEach(function (pattern) {
        for (var at = s.indexOf(pattern); at >= 0; at = s.indexOf(pattern, at + 1)) p += 40;
      });
    });
    return p + 10 * Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n));
  }

  function encode(text, version) {
    var bytes = Array.from(new TextEncoder().encode(String(text)));
    var v = Math.min(6, Math.max(1, Math.floor(version) || 1));
    while (v <= 6 && 4 + 8 + 8 * bytes.length > BLOCKS[v][1] * BLOCKS[v][2] * 8) v++;
    if (v > 6) return null;
    var ecLen = BLOCKS[v][0], nBlocks = BLOCKS[v][1], perBlock = BLOCKS[v][2], cap = nBlocks * perBlock;
    var i, b, k, x, y;

    // The data: mode 0100 (bytes), an 8-bit count, the bytes, a terminator of
    // up to four 0 bits, 0 bits to the byte, then the pad bytes 0xEC, 0x11 in turn.
    var bits = [];
    function put(val, len) { for (var j = len - 1; j >= 0; j--) bits.push((val >>> j) & 1); }
    put(4, 4);
    put(bytes.length, 8);
    bytes.forEach(function (byte) { put(byte, 8); });
    put(0, Math.min(4, cap * 8 - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    var data = [];
    for (i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (var pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);

    // Error correction per block, then data and correction interleaved by block.
    var div = divisor(ecLen), blocks = [], ecs = [], words = [];
    for (b = 0; b < nBlocks; b++) {
      blocks.push(data.slice(b * perBlock, (b + 1) * perBlock));
      ecs.push(remainder(blocks[b], div));
    }
    for (k = 0; k < perBlock; k++) for (b = 0; b < nBlocks; b++) words.push(blocks[b][k]);
    for (k = 0; k < ecLen; k++) for (b = 0; b < nBlocks; b++) words.push(ecs[b][k]);

    // The function patterns: timing, the three finders with their separators,
    // the one alignment pattern (versions 2-6), then the format areas.
    var n = 17 + 4 * v, dark = [], fixed = [];
    for (i = 0; i < n; i++) { dark.push(new Array(n).fill(false)); fixed.push(new Array(n).fill(false)); }
    function set(cx, cy, on) { dark[cy][cx] = on; fixed[cy][cx] = true; }
    for (i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [n - 4, 3], [3, n - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var px = c[0] + dx, py = c[1] + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
          if (px >= 0 && px < n && py >= 0 && py < n) set(px, py, d !== 2 && d !== 4);
        }
      }
    });
    if (v > 1) {
      for (y = -2; y <= 2; y++) for (x = -2; x <= 2; x++) set(n - 7 + x, n - 7 + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
    // Format: level M (00) and the mask, BCH(15,5) protected, XOR 0x5412; two
    // copies, beside the top-left finder and split along the other two, plus
    // the dark module.
    function format(mask) {
      var rem = mask;
      for (var j = 0; j < 10; j++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((mask << 10) | rem) ^ 0x5412;
      var on = function (j) { return ((f >>> j) & 1) === 1; };
      for (j = 0; j <= 5; j++) set(8, j, on(j));
      set(8, 7, on(6));
      set(8, 8, on(7));
      set(7, 8, on(8));
      for (j = 9; j < 15; j++) set(14 - j, 8, on(j));
      for (j = 0; j < 8; j++) set(n - 1 - j, 8, on(j));
      for (j = 8; j < 15; j++) set(8, n - 15 + j, on(j));
      set(8, n - 8, true);
    }
    format(0);   // reserves the areas before the data goes in

    // The codewords, in two-module columns zigzagging up and down from the
    // bottom right, the vertical timing column skipped. Modules left over
    // (the remainder bits) stay light.
    var bit = 0, total = words.length * 8;
    for (var right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      var up = ((right + 1) & 2) === 0;
      for (var vert = 0; vert < n; vert++) {
        for (var j = 0; j < 2; j++) {
          x = right - j;
          y = up ? n - 1 - vert : vert;
          if (!fixed[y][x] && bit < total) {
            dark[y][x] = ((words[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
            bit++;
          }
        }
      }
    }

    // Each mask with its own format bits; the lowest penalty wins.
    var best = null, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      format(m);
      var g = dark.map(function (r, ry) {
        return r.map(function (on, rx) { return fixed[ry][rx] ? on : on !== flip(m, rx, ry); });
      });
      var s = penalty(g);
      if (s < bestScore) { best = g; bestScore = s; }
    }
    return best;
  }

  window.OAQRCode = encode;
})();
