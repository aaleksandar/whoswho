// WhosWho · Pop-up Zoo: spirit animals, pins and the living paper city.
(function () {
var Z = window.WWZoo = {};
Z.drawAnimal = function (out, kind) {
    const art = document.createElement('canvas'); art.width = art.height = 512;
    const x = art.getContext('2d'), INK = '#2A1E16', PI = Math.PI;
    x.translate(256, 296); x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = 8; x.strokeStyle = INK;
    const st = (s) => { if (s !== false) x.stroke(); };
    const C = (cx, cy, r, f, s) => { x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fillStyle = f; x.fill(); st(s); };
    const E = (cx, cy, rx, ry, rot, f, s) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, 6.283); x.fillStyle = f; x.fill(); st(s); };
    const Pg = (pts, f, s) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); x.fillStyle = f; x.fill(); st(s); };
    const M = (fn) => { fn(1); fn(-1); };
    const eyes = (dx, dy, r) => M((m) => { C(dx * m, dy, r, INK, false); C(dx * m + r * 0.35, dy - r * 0.38, r * 0.33, '#fff', false); });
    const blush = (dx, dy) => { x.globalAlpha = 0.4; M((m) => C(dx * m, dy, 24, '#FF6F91', false)); x.globalAlpha = 1; };
    const wm = (y) => { x.lineWidth = 6; x.beginPath(); x.arc(-14, y, 14, 0.1 * PI, 0.9 * PI); x.moveTo(28, y); x.arc(14, y, 14, 0.1 * PI, 0.9 * PI); x.stroke(); x.lineWidth = 8; };
    const smile = (y, r) => { x.beginPath(); x.arc(0, y - r, r, 0.25 * PI, 0.75 * PI); x.stroke(); };
    const nose = (y, c) => Pg([[0, y + 16], [-16, y], [16, y]], c || INK, false);
    const whisk = (y) => { x.lineWidth = 4; M((m) => { x.beginPath(); x.moveTo(62 * m, y); x.lineTo(140 * m, y - 14); x.moveTo(62 * m, y + 14); x.lineTo(140 * m, y + 22); x.stroke(); }); x.lineWidth = 8; };
    const H = (f) => C(0, 0, 145, f);
    const ring = () => { x.beginPath(); x.arc(0, 0, 145, 0, 6.283); x.stroke(); };
    const clip = (fn) => { x.save(); x.beginPath(); x.arc(0, 0, 145, 0, 6.283); x.clip(); fn(); x.restore(); ring(); };
    const triEar = (a, b, c, f, inner) => M((m) => {
      Pg([[a[0] * m, a[1]], [b[0] * m, b[1]], [c[0] * m, c[1]]], f);
      if (inner) { const cx = (a[0] + b[0] + c[0]) / 3 * m, cy = (a[1] + b[1] + c[1]) / 3; Pg([a, b, c].map((p) => [cx + (p[0] * m - cx) * 0.5, cy + (p[1] - cy) * 0.5]), inner, false); }
    });
    const roundEar = (dx, dy, r, f, inner) => M((m) => { C(dx * m, dy, r, f); if (inner) C(dx * m, dy, r * 0.55, inner, false); });
    switch (kind) {
      case 'fox':
        triEar([-135, -55], [-138, -245], [-20, -130], '#FF7A3D', '#3A2320'); H('#FF7A3D');
        clip(() => { x.beginPath(); x.moveTo(-160, 10); x.quadraticCurveTo(-60, 0, 0, 62); x.quadraticCurveTo(60, 0, 160, 10); x.lineTo(160, 170); x.lineTo(-160, 170); x.closePath(); x.fillStyle = '#FFF6EC'; x.fill(); });
        eyes(56, -14, 18); nose(30); wm(52); blush(98, 48); break;
      case 'cat':
        triEar([-125, -70], [-118, -218], [-25, -135], '#B9BCCB', '#FFB3C7'); H('#B9BCCB');
        x.lineWidth = 10; x.strokeStyle = '#8A8DA0'; [[-30, -130, -22, -95], [0, -140, 0, -100], [30, -130, 22, -95]].forEach((l) => { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke(); }); x.strokeStyle = INK; x.lineWidth = 8;
        eyes(56, -10, 18); nose(26, '#FF6F91'); wm(46); whisk(40); blush(100, 50); break;
      case 'bear':
        roundEar(112, -108, 52, '#A86B45', '#E7B98F'); H('#A86B45'); E(0, 58, 72, 54, 0, '#E7C9A6'); E(0, 36, 24, 16, 0, INK, false); eyes(56, -16, 17); wm(64); blush(104, 36); break;
      case 'rabbit':
        M((m) => { E(-58 * m, -215, 38, 108, -0.12 * m, '#E4DCF2'); E(-58 * m, -210, 18, 75, -0.12 * m, '#FFB3C7', false); });
        H('#E4DCF2'); eyes(56, -12, 18); nose(28, '#FF6F91'); wm(48);
        x.fillStyle = '#fff'; x.fillRect(-12, 62, 24, 22); x.lineWidth = 4; x.strokeRect(-12, 62, 24, 22); x.beginPath(); x.moveTo(0, 62); x.lineTo(0, 84); x.stroke(); x.lineWidth = 8; blush(98, 48); break;
      case 'frog':
        M((m) => C(80 * m, -112, 62, '#62C370')); E(0, 0, 172, 128, 0, '#62C370'); M((m) => C(80 * m, -118, 36, '#fff')); eyes(80, -116, 18);
        x.beginPath(); x.arc(0, -10, 100, 0.22 * PI, 0.78 * PI); x.stroke(); blush(112, 40); break;
      case 'panda':
        roundEar(115, -105, 50, INK); H('#FAFAFA'); M((m) => E(58 * m, -2, 40, 54, 0.5 * m, INK, false)); M((m) => { C(56 * m, -8, 14, '#fff', false); C(56 * m, -8, 8, INK, false); });
        E(0, 42, 24, 16, 0, INK, false); wm(60); break;
      case 'owl':
        triEar([-138, -60], [-122, -205], [-48, -128], '#9A6B4A', '#6E4A33'); E(0, 0, 150, 160, 0, '#9A6B4A'); E(0, 18, 128, 118, 0, '#D8B48A', false);
        M((m) => { C(62 * m, -12, 54, '#FFB020'); C(62 * m, -12, 42, '#fff', false); }); eyes(62, -10, 22); Pg([[0, 62], [-20, 28], [20, 28]], '#FFB020'); break;
      case 'pig':
        triEar([-138, -40], [-150, -180], [-45, -128], '#FF9FB8', '#FF7FA0'); H('#FF9FB8'); eyes(60, -22, 17); E(0, 46, 64, 44, 0, '#FF7FA0'); M((m) => E(20 * m, 46, 9, 15, 0, INK, false)); blush(108, 30); break;
      case 'lion':
        for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283; C(Math.cos(a) * 165, Math.sin(a) * 165, 46, '#C8742E'); }
        C(0, 0, 168, '#C8742E', false); roundEar(100, -112, 36, '#F5B94E', '#C8742E'); H('#F5B94E'); M((m) => E(28 * m, 58, 36, 30, 0, '#FFF1D6', false)); nose(30, '#6B3A22'); eyes(56, -20, 17); blush(100, 40); break;
      case 'tiger':
        roundEar(108, -108, 44, '#FF8A2B', '#FFF6EC'); H('#FF8A2B');
        clip(() => { Pg([[-22, -150], [0, -95], [22, -150]], INK, false); M((m) => { Pg([[-72 * m, -140], [-46 * m, -100], [-40 * m, -146]], INK, false); Pg([[150 * m, -12], [96 * m, 4], [150 * m, 16]], INK, false); Pg([[150 * m, 38], [102 * m, 50], [150 * m, 62]], INK, false); }); });
        M((m) => E(30 * m, 54, 40, 32, 0, '#FFF6EC', false)); E(0, 98, 32, 18, 0, '#FFF6EC', false); nose(28, '#FF6F91'); eyes(58, -20, 17); break;
      case 'monkey':
        M((m) => { C(140 * m, -5, 46, '#8B5A3C'); C(140 * m, -5, 26, '#E8B48C', false); }); H('#8B5A3C');
        C(-45, -25, 55, '#F2C9A0', false); C(45, -25, 55, '#F2C9A0', false); E(0, 45, 96, 72, 0, '#F2C9A0', false);
        eyes(45, -25, 16); M((m) => E(11 * m, 32, 5, 8, 0, INK, false)); smile(88, 42); blush(84, 52); break;
      case 'penguin':
        Pg([[-16, -138], [0, -188], [16, -138]], '#26304A'); H('#26304A'); C(-45, -5, 62, '#FFFFFF', false); C(45, -5, 62, '#FFFFFF', false); E(0, 55, 92, 62, 0, '#FFFFFF', false);
        eyes(48, -10, 16); Pg([[-24, 30], [24, 30], [0, 64]], '#FF9A3D'); blush(92, 40); break;
      case 'dog':
        H('#E3B26E'); E(52, -20, 42, 36, 0, '#C98C4A', false); M((m) => E(136 * m, 4, 48, 96, -0.35 * m, '#8A5A35'));
        E(0, 58, 70, 50, 0, '#FFF1DA'); E(0, 36, 26, 18, 0, INK, false); wm(64); E(0, 104, 16, 18, 0, '#FF6F91'); eyes(54, -18, 17); break;
      case 'mouse':
        roundEar(118, -115, 72, '#B8B2C8', '#FFB3C7'); H('#B8B2C8'); eyes(52, -8, 16); E(0, 40, 13, 10, 0, '#FF6F91', false); whisk(42);
        x.fillStyle = '#fff'; x.fillRect(-10, 66, 20, 16); x.lineWidth = 4; x.strokeRect(-10, 66, 20, 16); x.lineWidth = 8; blush(96, 46); break;
      case 'raccoon':
        triEar([-128, -70], [-112, -205], [-35, -135], '#8E8EA0', '#3A3442'); H('#8E8EA0');
        clip(() => { E(0, -6, 140, 46, 0, '#3A3442', false); M((m) => E(52 * m, -66, 40, 14, 0, '#FFFFFF', false)); });
        E(0, 60, 62, 46, 0, '#FFFFFF'); E(0, 42, 20, 14, 0, INK, false); M((m) => C(55 * m, -6, 19, '#fff', false)); eyes(55, -6, 11); break;
      case 'koala':
        roundEar(126, -90, 70, '#A9AFBD', '#F2EEF7'); H('#A9AFBD'); eyes(58, -24, 15); E(0, 34, 30, 44, 0, '#3A3442'); blush(104, 44); break;
      case 'elephant':
        M((m) => { E(150 * m, 0, 85, 110, -0.15 * m, '#9DB2CF'); E(150 * m, 0, 55, 78, -0.15 * m, '#FFC7D6', false); }); H('#9DB2CF');
        x.beginPath(); x.moveTo(-34, 30); x.quadraticCurveTo(-40, 140, 8, 168); x.quadraticCurveTo(48, 176, 58, 148); x.quadraticCurveTo(30, 148, 28, 118); x.lineTo(34, 30); x.fillStyle = '#9DB2CF'; x.fill(); x.stroke();
        x.lineWidth = 4; [60, 85, 110].forEach((y) => { x.beginPath(); x.moveTo(-28, y); x.lineTo(22, y); x.stroke(); }); x.lineWidth = 8;
        eyes(62, -26, 16); blush(104, 40); break;
      case 'hedgehog': {
        const pts = []; for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283, r = k % 2 ? 150 : 196; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.95]); }
        Pg(pts, '#7A5236'); C(0, 0, 150, '#7A5236', false); E(0, 34, 122, 104, 0, '#F2D7B0'); eyes(48, 4, 16); C(0, 52, 15, INK, false); smile(92, 30); blush(88, 48); break;
      }
      case 'sheep':
        for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; C(Math.cos(a) * 148, Math.sin(a) * 148 - 8, 50, '#FFFFFF'); }
        C(0, -8, 150, '#FFFFFF', false); M((m) => E(118 * m, 16, 50, 22, 0.3 * m, '#3A2E2A')); E(0, 32, 90, 112, 0, '#3A2E2A');
        C(-32, -82, 32, '#fff'); C(32, -82, 32, '#fff'); C(0, -94, 34, '#fff');
        M((m) => C(38 * m, 14, 17, '#fff', false)); eyes(38, 14, 9); x.strokeStyle = '#fff'; x.lineWidth = 6; smile(108, 26); x.strokeStyle = INK; x.lineWidth = 8; break;
      case 'cow':
        M((m) => Pg([[-70 * m, -120], [-118 * m, -196], [-102 * m, -108]], '#F3E3C3')); M((m) => E(150 * m, -40, 56, 26, 0.35 * m, '#FFFFFF')); H('#FFFFFF');
        clip(() => { E(-82, -62, 70, 55, 0.4, INK, false); E(96, -92, 50, 40, -0.3, INK, false); });
        E(0, 72, 96, 62, 0, '#FFB3C7'); M((m) => E(32 * m, 72, 10, 15, 0, '#C2557A', false)); M((m) => C(56 * m, -18, 21, '#fff', false)); eyes(56, -18, 15); break;
      case 'chick':
        E(-20, -150, 16, 38, -0.4, '#FFD84D'); E(10, -158, 16, 42, 0.2, '#FFD84D'); H('#FFD84D'); eyes(52, -10, 18); Pg([[-28, 24], [28, 24], [0, 60]], '#FF9A3D'); blush(96, 40); break;
      case 'unicorn':
        [['#FFD84D', -100, -140], ['#FF9DBF', -134, -88], ['#A9C8FF', -152, -16], ['#C9F2DE', -140, 56]].forEach((c) => C(c[1], c[2], 52, c[0]));
        triEar([-120, -80], [-108, -200], [-40, -132], '#F7F3FF', '#FFC7D6'); H('#F7F3FF');
        Pg([[-26, -126], [26, -126], [0, -252]], '#FFD84D'); x.lineWidth = 4; [[-18, -150, 18, -162], [-12, -185, 12, -196], [-6, -218, 6, -226]].forEach((l) => { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke(); }); x.lineWidth = 8;
        C(-70, -112, 38, '#FF9DBF'); C(-30, -128, 32, '#A9C8FF');
        E(0, 74, 72, 44, 0, '#FFE0EA'); M((m) => E(24 * m, 72, 7, 11, 0, '#C2557A', false)); eyes(56, -6, 17); blush(104, 30); break;
    }
    const sil = document.createElement('canvas'); sil.width = sil.height = 512;
    const s = sil.getContext('2d'); s.drawImage(art, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#FFFDF8'; s.fillRect(0, 0, 512, 512);
    const brd = document.createElement('canvas'); brd.width = brd.height = 512; const b = brd.getContext('2d');
    for (let a = 0; a < 20; a++) b.drawImage(sil, Math.cos(a / 20 * 6.283) * 18, Math.sin(a / 20 * 6.283) * 18);
    b.drawImage(sil, 0, 0);
    out.clearRect(0, 0, 512, 512);
    out.save(); out.shadowColor = 'rgba(60,35,15,.3)'; out.shadowBlur = 16; out.shadowOffsetY = 10; out.drawImage(brd, 0, 0); out.restore();
    out.drawImage(art, 0, 0);
  };

Z.city = function (ctx, opts) {
    const T = ctx.T, S = ctx.scene, top = (x, y) => { const h = ctx.topAt(x, y); return h < 0 ? ctx.maxTop : h; };
    const RY = ctx.maxTop + 0.025;
    const P = (lat, lon) => [(lon + 0.1278) * 69.29, (lat - 51.5074) * 110.57];
    const mat = (c) => new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 1, flatShading: true });
    const shadowy = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
    const box = (w, h, d, c, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c)); m.position.set(x || 0, (y || 0) + h / 2, z || 0); return m; };
    const cyl = (rt, rb, h, seg, c, x, y, z) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat(c)); m.position.set(x || 0, (y || 0) + h / 2, z || 0); return m; };
    const cone = (r, h, seg, c, x, y, z, ry) => { const m = new T.Mesh(new T.ConeGeometry(r, h, seg), mat(c)); m.position.set(x || 0, (y || 0) + h / 2, z || 0); m.rotation.y = ry || 0; return m; };
    const place = (g, lat, lon, ry, yOverride) => { const p = P(lat, lon); g.position.set(p[0], yOverride != null ? yOverride : top(p[0], p[1]), -p[1]); g.rotation.y = ry || 0; S.add(shadowy(g)); return g; };
    const marks = [];
    const keep = (lat, lon, r) => { const p = P(lat, lon); marks.push([p[0], -p[1], r]); };

    // parks: green paper layers with paper trees
    const parks = [[51.5073, -0.1657, 1.3, 0.5, 0.05, 1], [51.5313, -0.157, 0.62, 0.55, 0, 0], [51.5608, -0.163, 0.85, 0.7, 0.3, 0], [51.4425, -0.275, 1.7, 1.5, 0.2, 0], [51.4769, -0.0005, 0.45, 0.36, 0, 0], [51.5362, -0.04, 0.72, 0.3, -0.35, 0], [51.4791, -0.1566, 0.42, 0.3, 0, 0], [51.4615, -0.15, 0.42, 0.3, 0.2, 0], [51.434, -0.235, 0.9, 0.8, 0, 0], [51.41, -0.335, 0.95, 0.7, 0.3, 0], [51.557, -0.027, 0.42, 0.7, 0.2, 0], [51.421, -0.069, 0.42, 0.35, 0, 0], [51.615, 0.03, 0.6, 1.4, 0.15, 0]];
    const treePts = [];
    parks.forEach((pk) => {
      const c = P(pk[0], pk[1]), y = top(c[0], c[1]);
      const sh = new T.Shape(); sh.absellipse(0, 0, pk[2], pk[3], 0, Math.PI * 2, false, pk[4]);
      const g = new T.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 28 }); g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0xA8D39A })); m.position.set(c[0], y, -c[1]); m.receiveShadow = true; S.add(m);
      if (pk[5]) { const pond = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshLambertMaterial({ color: 0x86B8EA })); pond.scale.set(0.45, 0.09, 1); pond.rotation.x = -Math.PI / 2; pond.rotation.z = -0.35; pond.position.set(c[0] + 0.1, y + 0.06, -c[1]); S.add(pond); }
      const n = Math.round(pk[2] * pk[3] * 16) + 4;
      for (let k = 0; k < n; k++) { const a = ctx.rnd() * 6.283, rr = Math.sqrt(ctx.rnd()) * 0.85; const lx = Math.cos(a) * pk[2] * rr, ly = Math.sin(a) * pk[3] * rr; const cr = Math.cos(pk[4]), sr = Math.sin(pk[4]); treePts.push([c[0] + lx * cr - ly * sr, c[1] + lx * sr + ly * cr, y + 0.05, 0.16 + ctx.rnd() * 0.12]); }
    });
    for (let k = 0; k < 260; k++) { const x = -24 + ctx.rnd() * 52, y = -20 + ctx.rnd() * 40, h = ctx.topAt(x, y); if (h < 0 || Math.hypot(x - 1.5, y) < 5 || ctx.nearRiver(x, -y, 0.3)) continue; treePts.push([x, y, h, 0.14 + ctx.rnd() * 0.1]); }
    const crown = new T.IcosahedronGeometry(1, 0), trunk = new T.CylinderGeometry(0.2, 0.25, 1, 5);
    const ci = new T.InstancedMesh(crown, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), treePts.length);
    const ti = new T.InstancedMesh(trunk, mat('#9A6B4A'), treePts.length);
    ci.castShadow = ti.castShadow = true;
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), V3 = new T.Vector3(), SC = new T.Vector3(), COL = new T.Color(), greens = ['#7DBE7A', '#5FA86E', '#9CCF8A', '#6FB58A'];
    treePts.forEach((tp, k) => {
      const s = tp[3];
      V3.set(tp[0], tp[2] + s * 0.5, -tp[1]); SC.set(s * 0.3, s, s * 0.3); M4.compose(V3, Q, SC); ti.setMatrixAt(k, M4);
      V3.set(tp[0], tp[2] + s * 1.35, -tp[1]); SC.set(s, s * 1.1, s); M4.compose(V3, Q, SC); ci.setMatrixAt(k, M4);
      ci.setColorAt(k, COL.set(greens[k % greens.length]));
    });
    S.add(ci); S.add(ti);

    // landmarks (papercraft)
    { const g = new T.Group(); g.add(box(0.17, 1.3, 0.17, '#E8C98E')); g.add(box(0.21, 0.16, 0.21, '#FFFDF8', 0, 0.98)); g.add(cone(0.15, 0.42, 4, '#6E8FA8', 0, 1.14, 0, Math.PI / 4)); g.add(box(0.24, 0.26, 0.95, '#E3C489', 0, 0, 0.56)); g.add(box(0.2, 0.62, 0.2, '#E8C98E', 0, 0, 1.05)); place(g, 51.5007, -0.1246, 0.15); keep(51.5007, -0.1246, 0.6); }
    let eyeRim;
    { const g = new T.Group(); eyeRim = new T.Group(); eyeRim.position.y = 0.86;
      eyeRim.add(new T.Mesh(new T.TorusGeometry(0.72, 0.035, 6, 48), mat('#FFFFFF')));
      for (let k = 0; k < 16; k++) { const sp = new T.Mesh(new T.BoxGeometry(0.012, 1.44, 0.012), mat('#FFFFFF')); sp.rotation.z = k / 16 * Math.PI; eyeRim.add(sp); }
      for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, pod = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), mat('#BFE3F7')); pod.scale.set(1, 0.8, 1.6); pod.position.set(Math.cos(a) * 0.74, Math.sin(a) * 0.74, 0); eyeRim.add(pod); }
      eyeRim.add(new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.12, 10).rotateX(Math.PI / 2), mat('#FFFFFF')));
      g.add(eyeRim); [-1, 1].forEach((m) => { const leg = new T.Mesh(new T.BoxGeometry(0.04, 0.95, 0.04), mat('#FFFFFF')); leg.position.set(m * 0.18, 0.44, 0.12); leg.rotation.z = m * 0.2; g.add(leg); });
      place(g, 51.5033, -0.1196, -0.4); keep(51.5033, -0.1196, 0.8); }
    { const g = new T.Group(); g.add(cone(0.3, 2.6, 4, '#CFE3F2', 0, 0, 0, Math.PI / 4)); place(g, 51.5045, -0.0865); keep(51.5045, -0.0865, 0.4); }
    let bascules = [];
    { const g = new T.Group(), stone = '#E6D3A8', blue = '#7FB2E5';
      [-0.56, 0.56].forEach((z) => { g.add(box(0.2, 0.95, 0.22, stone, 0, 0, z)); [[-0.08, -0.09], [0.08, -0.09], [-0.08, 0.09], [0.08, 0.09]].forEach((c) => g.add(cone(0.035, 0.18, 4, stone, c[0], 0.95, z + c[1]))); g.add(cone(0.08, 0.22, 4, '#6E8FA8', 0, 0.95, z, Math.PI / 4)); });
      [-0.06, 0.06].forEach((x) => g.add(box(0.05, 0.06, 0.92, blue, x, 0.78, 0)));
      [-1, 1].forEach((m) => { g.add(box(0.16, 0.05, 0.55, blue, 0, 0.14, m * 0.95)); });
      [-1, 1].forEach((m) => { const piv = new T.Group(); piv.position.set(0, 0.16, m * 0.45); const leaf = box(0.16, 0.04, 0.45, blue); leaf.position.set(0, 0, -m * 0.225); piv.add(leaf); g.add(piv); bascules.push([piv, m]); });
      place(g, 51.5055, -0.0754, 0.05, RY - 0.02); keep(51.5055, -0.0754, 1.1); }
    { const g = new T.Group(), c = '#EFE7D6'; g.add(box(0.36, 0.26, 0.7, c)); g.add(box(0.7, 0.22, 0.24, c)); g.add(cyl(0.16, 0.17, 0.2, 14, c, 0, 0.26)); const d = new T.Mesh(new T.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#9FB4BE')); d.position.y = 0.46; g.add(d); g.add(cyl(0.04, 0.05, 0.12, 8, c, 0, 0.64)); g.add(cone(0.03, 0.1, 6, '#E8C14A', 0, 0.76)); [-0.12, 0.12].forEach((x) => { g.add(box(0.1, 0.42, 0.1, c, x, 0, 0.36)); g.add(cone(0.05, 0.1, 4, '#9FB4BE', x, 0.42, 0.36)); }); place(g, 51.5138, -0.0984, 0); keep(51.5138, -0.0984, 0.5); }
    { const prof = [[0, 0], [0.17, 0], [0.22, 0.3], [0.22, 0.62], [0.17, 0.96], [0.08, 1.16], [0, 1.22]].map((p) => new T.Vector2(p[0], p[1])); const g = new T.Group(); g.add(new T.Mesh(new T.LatheGeometry(prof, 10), mat('#5E8C8A'))); place(g, 51.5145, -0.0803); keep(51.5145, -0.0803, 0.3); }
    { const g = new T.Group(); g.add(box(0.26, 2.0, 0.26, '#C9D6E2')); g.add(cone(0.19, 0.34, 4, '#9FB4BE', 0, 2.0, 0, Math.PI / 4)); g.add(box(0.24, 1.4, 0.24, '#B9C7D6', 0.36, 0, 0.1)); g.add(box(0.24, 1.25, 0.24, '#D7E0EA', -0.34, 0, 0.12)); g.add(box(0.2, 0.9, 0.2, '#C9D6E2', 0.1, 0, 0.42)); place(g, 51.5049, -0.0195); keep(51.5049, -0.0195, 0.7); }
    { const g = new T.Group(); const d = new T.Mesh(new T.SphereGeometry(0.85, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#FFFFFF')); d.scale.y = 0.42; g.add(d); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, mm = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.75, 5), mat('#FFD84D')); mm.position.set(Math.cos(a) * 0.72, 0.36, Math.sin(a) * 0.72); mm.rotation.z = -Math.cos(a) * 0.2; mm.rotation.x = Math.sin(a) * 0.2; g.add(mm); } place(g, 51.503, 0.0032); keep(51.503, 0.0032, 1.0); }
    { const g = new T.Group(); g.add(cyl(0.07, 0.09, 1.6, 10, '#E9E4DA')); g.add(cyl(0.11, 0.11, 0.26, 12, '#9FB4BE', 0, 1.18)); g.add(cyl(0.012, 0.012, 0.3, 4, '#E9E4DA', 0, 1.6)); place(g, 51.5215, -0.1389); keep(51.5215, -0.1389, 0.3); }
    { const g = new T.Group(); g.add(box(0.72, 0.4, 0.46, '#C98A5E')); [[-0.33, -0.2], [0.33, -0.2], [-0.33, 0.2], [0.33, 0.2]].forEach((c) => g.add(cyl(0.045, 0.06, 0.72, 10, '#FFFDF8', c[0], 0.4, c[1]))); place(g, 51.4816, -0.1445, 0.3); keep(51.4816, -0.1445, 0.6); }
    { const g = new T.Group(); g.add(cyl(0.62, 0.56, 0.2, 28, '#F2EEE6')); const arch = new T.Mesh(new T.TorusGeometry(0.75, 0.035, 6, 36, Math.PI), mat('#FFFFFF')); arch.rotation.y = 0.6; arch.position.y = 0.1; g.add(arch); place(g, 51.556, -0.2796); keep(51.556, -0.2796, 0.9); }

    // houses and blocks, so the boroughs aren't empty
    const nearMark = (x, z) => marks.some((m) => Math.hypot(x - m[0], z - m[1]) < m[2]);
    const hb = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), hr = new T.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const HN = 900, walls = new T.InstancedMesh(hb, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), HN), roofs = new T.InstancedMesh(hr, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), HN);
    walls.castShadow = roofs.castShadow = true; walls.receiveShadow = true;
    const roofC = ['#E07A5F', '#7FB2E5', '#81B29A', '#F2CC8F', '#C98A5E'], wallC = ['#FFFDF8', '#FFF3E2', '#F7E9E1'];
    let hn = 0, guard = 0;
    while (hn < HN && guard++ < 20000) {
      const rr = 3.5 + Math.pow(ctx.rnd(), 0.8) * 18, an = ctx.rnd() * 6.283, x = 1.5 + Math.cos(an) * rr, y = 0.3 + Math.sin(an) * rr * 0.8, h = ctx.topAt(x, y);
      if (h < 0 || ctx.nearRiver(x, -y, 0.3) || nearMark(x, -y)) continue;
      const s = 0.13 + ctx.rnd() * 0.08; Q.setFromAxisAngle(new T.Vector3(0, 1, 0), ctx.rnd() * 3);
      V3.set(x, h, -y); SC.set(s, s * 0.8, s * 1.2); M4.compose(V3, Q, SC); walls.setMatrixAt(hn, M4); walls.setColorAt(hn, COL.set(wallC[hn % 3]));
      V3.set(x, h + s * 0.8, -y); SC.set(s * 1.05, s * 0.5, s * 1.25); M4.compose(V3, Q, SC); roofs.setMatrixAt(hn, M4); roofs.setColorAt(hn, COL.set(roofC[hn % roofC.length]));
      hn++;
    }
    walls.count = roofs.count = hn; S.add(walls); S.add(roofs);
    const BN = 520, blocks = new T.InstancedMesh(hb, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), BN); blocks.castShadow = true; blocks.receiveShadow = true;
    let bn = 0; guard = 0;
    while (bn < BN && guard++ < 20000) {
      const rr = Math.pow(ctx.rnd(), 1.3) * 4.6, an = ctx.rnd() * 6.283, x = 0.8 + Math.cos(an) * rr * 1.3, y = 0.6 + Math.sin(an) * rr * 0.8, h = ctx.topAt(x, y);
      if (h < 0 || ctx.nearRiver(x, -y, 0.22) || nearMark(x, -y)) continue;
      const w = 0.14 + ctx.rnd() * 0.16; Q.setFromAxisAngle(new T.Vector3(0, 1, 0), ctx.rnd() * 0.4);
      V3.set(x, h, -y); SC.set(w, 0.15 + ctx.rnd() * 0.45 * Math.exp(-rr / 3), w * (0.8 + ctx.rnd() * 0.5)); M4.compose(V3, Q, SC); blocks.setMatrixAt(bn, M4); blocks.setColorAt(bn, COL.set(['#FFFDF8', '#F3EADF', '#EADFD6', '#E8EEF3'][bn % 4])); bn++;
    }
    blocks.count = bn; S.add(blocks);

    // roads
    const road = (pts, closed) => new T.CatmullRomCurve3(pts.map((p) => { const q = P(p[0], p[1]); return new T.Vector3(q[0], 0, -q[1]); }), !!closed, 'centripetal');
    const routes = [
      road([[51.5136, -0.2], [51.5154, -0.1755], [51.5165, -0.142], [51.517, -0.12], [51.515, -0.0985], [51.5134, -0.089], [51.5155, -0.07], [51.519, -0.059], [51.525, -0.033], [51.531, -0.005], [51.54, 0.03]]),
      road([[51.5134, -0.089], [51.526, -0.08], [51.546, -0.076], [51.57, -0.072], [51.595, -0.07], [51.62, -0.065]]),
      road([[51.5055, -0.088], [51.496, -0.087], [51.485, -0.065], [51.476, -0.04], [51.468, -0.01], [51.462, 0.03], [51.452, 0.08]]),
      road([[51.5007, -0.1246], [51.486, -0.124], [51.47, -0.13], [51.456, -0.145], [51.44, -0.17], [51.42, -0.21], [51.4, -0.25]]),
      road([[51.513, -0.16], [51.53, -0.18], [51.55, -0.205], [51.575, -0.23], [51.6, -0.265]]),
      road([[51.502, -0.15], [51.495, -0.19], [51.492, -0.23], [51.488, -0.28], [51.48, -0.33]]),
      road([[51.513, -0.06], [51.511, -0.03], [51.512, 0.01], [51.52, 0.06], [51.53, 0.11], [51.54, 0.16]])
    ];
    const ringPts = []; for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283; ringPts.push(new T.Vector3(1.2 + Math.cos(a) * 11, 0, -(0.6 + Math.sin(a) * 8.5))); }
    const ringRoad = new T.CatmullRomCurve3(ringPts, true, 'centripetal');
    const bank = (side) => { const pts = []; for (let u = 0.2; u <= 0.8; u += 0.01) { const p = ctx.curve.getPointAt(u), tg = ctx.curve.getTangentAt(u), w = 0.32 + 0.55 * Math.pow(u, 1.8) + 0.3; pts.push(new T.Vector3(p.x - tg.z * w * side, 0, p.z + tg.x * w * side)); } return new T.CatmullRomCurve3(pts); };
    const banks = [bank(1), bank(-1)];
    const all = routes.concat([ringRoad], banks);
    const roadMat = new T.MeshLambertMaterial({ color: 0xD9C9B2 });
    all.forEach((cv, ri) => {
      const L = cv.getLength(), N = Math.max(40, Math.round(L * 5)), pos = [], idx = [], closed = ri === routes.length;
      for (let k = 0; k <= N; k++) { const u = (k / N) % 1, p = cv.getPointAt(closed ? u : k / N), tg = cv.getTangentAt(closed ? u : k / N), w = 0.06, y = top(p.x, -p.z) + 0.012; pos.push(p.x - tg.z * w, y, p.z + tg.x * w, p.x + tg.z * w, y, p.z - tg.x * w); if (k < N) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
      const m = new T.Mesh(gg, roadMat); m.receiveShadow = true; S.add(m);
    });

    // traffic: red buses, black cabs
    const bus = () => { const g = new T.Group(); g.add(box(0.13, 0.17, 0.36, '#E2353A')); g.add(box(0.135, 0.03, 0.33, '#3A2E2A', 0, 0.06)); g.add(box(0.135, 0.03, 0.33, '#3A2E2A', 0, 0.125)); g.add(box(0.13, 0.01, 0.36, '#FFFDF8', 0, 0.17)); return shadowy(g); };
    const cab = () => { const g = new T.Group(); g.add(box(0.11, 0.065, 0.24, '#2A2A30')); g.add(box(0.1, 0.055, 0.13, '#2A2A30', 0, 0.065, -0.01)); g.add(box(0.105, 0.03, 0.11, '#9FB4BE', 0, 0.075, -0.01)); g.add(box(0.04, 0.02, 0.03, '#FFD84D', 0, 0.12, 0.01)); return shadowy(g); };
    const veh = [];
    all.forEach((cv, ri) => {
      const L = cv.getLength(), n = Math.max(2, Math.round(L / 3.2)), closed = ri === routes.length;
      for (let k = 0; k < n; k++) { const isBus = (k + ri) % 3 === 0, m = isBus ? bus() : cab(); S.add(m); veh.push({ m, cv, closed, u: (k / n + ctx.rnd() * 0.05) % 1, sp: (isBus ? 0.55 : 0.9) / L * ((k % 2) ? 1 : -1) }); }
    });
    const boatG = () => { const g = new T.Group(); g.add(box(0.16, 0.06, 0.5, '#FFFDF8')); g.add(box(0.12, 0.08, 0.22, '#7FB2E5', 0, 0.06, -0.04)); g.add(box(0.13, 0.015, 0.24, '#E2353A', 0, 0.14, -0.04)); return shadowy(g); };
    const boats = []; for (let k = 0; k < 8; k++) { const m = boatG(); S.add(m); boats.push({ m, u: 0.12 + k / 8 * 0.76, sp: (k % 2 ? 1 : -1) * 0.012, off: k % 2 ? 0.12 : -0.12 }); }

    // birds and paper clouds
    const wingG = new T.BufferGeometry(); wingG.setAttribute('position', new T.Float32BufferAttribute([0, 0, -0.05, 0.22, 0, 0.02, 0, 0, 0.06], 3)); wingG.computeVertexNormals();
    const wingM = new T.MeshLambertMaterial({ color: 0xFFFDF8, side: T.DoubleSide });
    const flocks = [[-3, 1.5, 4], [6, -3, 3], [-9, 6, 5]].map((f, fi) => {
      const birds = []; for (let k = 0; k < 8; k++) { const b = new T.Group(); const l = new T.Mesh(wingG, wingM), r = new T.Mesh(wingG, wingM); r.scale.x = -1; b.add(l); b.add(r); l.castShadow = r.castShadow = true; S.add(b); birds.push({ b, l, r, a: k * 0.18, dy: (k % 3) * 0.25, dr: (k % 4) * 0.3 }); }
      return { c: f, birds, sp: 0.18 + fi * 0.05 };
    });
    const cloudM = new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 1, flatShading: true });
    const clouds = []; for (let k = 0; k < 6; k++) { const g = new T.Group(); for (let j = 0; j < 4; j++) { const p = new T.Mesh(new T.IcosahedronGeometry(0.6 + ctx.rnd() * 0.5, 1), cloudM); p.position.set(j * 0.7 - 1, ctx.rnd() * 0.2, (ctx.rnd() - 0.5) * 0.6); p.scale.y = 0.55; p.castShadow = true; g.add(p); } g.position.set(-30 + k * 11, 8 + (k % 3) * 0.8, -(11 + (k * 3) % 6)); S.add(g); clouds.push(g); }

    const p = new T.Vector3(), tg = new T.Vector3();
    return {
      update: (t, dt) => {
        if (eyeRim) eyeRim.rotation.z = -t * 0.06;
        const cyc = t % 28, lift = cyc < 7 ? Math.sin(Math.min(1, cyc / 1.5) * Math.PI / 2) * Math.min(1, (7 - cyc) / 1.5) : 0;
        bascules.forEach((b) => { b[0].rotation.x = -b[1] * -lift * 1.05; });
        const moving = opts.traffic();
        veh.forEach((v) => {
          v.m.visible = moving; if (!moving) return;
          v.u += v.sp * dt; if (v.u > 1) v.u -= 1; if (v.u < 0) v.u += 1;
          v.cv.getPointAt(v.u, p); v.cv.getTangentAt(v.u, tg); if (v.sp < 0) tg.multiplyScalar(-1);
          const lane = v.sp < 0 ? -0.035 : 0.035, y = top(p.x, -p.z) + 0.015;
          v.m.position.set(p.x - tg.z * lane, y, p.z + tg.x * lane); v.m.lookAt(v.m.position.x + tg.x, y, v.m.position.z + tg.z);
          const f = v.closed ? 1 : Math.min(1, v.u / 0.04, (1 - v.u) / 0.04); v.m.scale.setScalar(Math.max(0.001, f));
        });
        boats.forEach((b) => {
          b.m.visible = moving; if (!moving) return;
          b.u += b.sp * dt; if (b.u > 0.92) b.u = 0.1; if (b.u < 0.1) b.u = 0.92;
          ctx.curve.getPointAt(b.u, p); ctx.curve.getTangentAt(b.u, tg); if (b.sp < 0) tg.multiplyScalar(-1);
          b.m.position.set(p.x - tg.z * b.off, RY + Math.sin(t * 2 + b.u * 40) * 0.01, p.z + tg.x * b.off); b.m.lookAt(b.m.position.x + tg.x, b.m.position.y, b.m.position.z + tg.z);
        });
        flocks.forEach((f) => f.birds.forEach((b) => {
          const a = t * f.sp + b.a, R = f.c[2] + b.dr;
          b.b.position.set(f.c[0] + Math.cos(a) * R, 6.5 + b.dy + Math.sin(t * 0.7 + b.a) * 0.3, -(f.c[1] + Math.sin(a) * R * 0.7));
          b.b.rotation.y = -a; const fl = Math.sin(t * 9 + b.a * 10) * 0.6; b.l.rotation.z = fl; b.r.rotation.z = -fl;
        }));
        const showC = opts.clouds();
        clouds.forEach((c) => { c.visible = showC; c.position.x += dt * 0.35; if (c.position.x > 34) c.position.x = -34; });
      }
    };
  };

Z.kinds = ['fox', 'cat', 'bear', 'rabbit', 'frog', 'panda', 'owl', 'pig', 'lion', 'tiger', 'monkey', 'penguin', 'dog', 'mouse', 'raccoon', 'koala', 'elephant', 'hedgehog', 'sheep', 'cow', 'chick', 'unicorn'];

// A glossy map pin whose head is the guest's spirit animal. Hops slowly; the focused one hops higher and faster.
Z.pin = function (ctx, g, i, at, color) {
  var T = ctx.T, grp = new T.Group(); grp.position.set(at.x, at.y, at.z); ctx.scene.add(grp);
  var body = new T.Group(); grp.add(body);
  var mat = new T.MeshPhysicalMaterial({ color: new T.Color(color), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  var cone = new T.Mesh(new T.ConeGeometry(0.4, 1.6, 32), mat); cone.rotation.x = Math.PI; cone.position.y = 0.8; cone.castShadow = true; body.add(cone);
  var head = new T.Mesh(new T.SphereGeometry(0.72, 32, 24), mat); head.position.y = 2.0; head.castShadow = true; body.add(head);
  var cv = document.createElement('canvas'); cv.width = cv.height = 512;
  Z.drawAnimal(cv.getContext('2d'), g.animal);
  var tex = new T.CanvasTexture(cv); tex.needsUpdate = true;
  var face = new T.Sprite(new T.SpriteMaterial({ map: tex })); grp.add(face);
  var sh = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshBasicMaterial({ map: window.WWMap.glowTex(T, 'rgba(70,40,15,.5)', 'rgba(70,40,15,.25)'), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; grp.add(sh);
  var ring = new T.Mesh(new T.RingGeometry(0.55, 0.72, 36), new T.MeshBasicMaterial({ color: new T.Color(color) })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; grp.add(ring);
  var ph = (i * 0.61) % 3.4, h = 0, S = 0.7, tmp = new T.Vector3();
  return {
    i: i, pick: [cone, head, face],
    update: function (t, dt, isF) {
      S += ((isF ? 1.05 : 0.7) - S) * Math.min(1, dt * 4);
      var per = isF ? 1.7 : 3.4, u = ((t + ph) % per) / per, air = isF ? 0.55 : 0.36;
      var sy = 1, sx = 1; h = 0;
      if (u < air) { var k = u / air, s = Math.sin(Math.PI * k); h = s * (isF ? 1.8 : 1.1); sy = 1 + 0.1 * s; sx = 1 - 0.04 * s; }
      else { var k2 = (u - air) / (1 - air); if (k2 < 0.12) { var q = Math.sin(Math.PI * k2 / 0.12); sy = 1 - 0.18 * q; sx = 1 + 0.1 * q; } }
      body.position.y = h; body.scale.set(sx * S, sy * S, sx * S);
      var hy = h + 2.0 * sy * S;
      tmp.copy(ctx.cam.position).sub(grp.position); tmp.y -= hy; tmp.normalize().multiplyScalar(0.8 * S);
      face.position.set(tmp.x, hy + tmp.y, tmp.z); face.scale.set(2.5 * S, 2.5 * S, 1);
      face.material.rotation = Math.sin(t * 1.1 + i) * 0.05;
      sh.scale.setScalar(Math.max(0.4, 1.1 - h * 0.25) * S); ring.scale.setScalar(S * 1.2); sh.material.opacity = Math.max(0.3, 1 - h * 0.3);
    },
    anchor: function (v) { return v.set(at.x, at.y + h + 3.9 * S, at.z); }
  };
};
})();
