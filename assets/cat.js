// Keep the 48 × 48 coordinate system when replacing this SVG with illustration assets.
function catArt(index) {
  const coats = [
    ["#efd4a0", "#b78d57"],
    ["#f8e9ce", "#bba78b"],
    ["#c1c3b7", "#858d80"],
    ["#efd4a0", "#b78d57"],
    ["#faf0dc", "#bba78b"],
    ["#e7bba0", "#b6886e"],
  ];
  const [coat, line] = coats[index % coats.length];
  const sleepy = index % 9 === 5;
  return `<g class="cat-character"><ellipse cx="24" cy="44" rx="16" ry="3" fill="#65734d" opacity=".09"/><path d="M37 36 Q48 36 44 27" fill="none" stroke="${coat}" stroke-width="5" stroke-linecap="round"/><g class="cat-body"><ellipse cx="24" cy="33" rx="12" ry="11" fill="${coat}"/><g class="cat-feet"><ellipse cx="17" cy="42" rx="5" ry="3" fill="${coat}"/><ellipse cx="31" cy="42" rx="5" ry="3" fill="${coat}"/></g><path d="M8 20 L9 5 Q10 2 13 5 L20 10 Q25 8 29 10 L37 4 Q40 2 40 6 L41 21 Q43 34 25 35 Q6 35 8 20" fill="${coat}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 9 L12 16 L18 13 M36 9 L31 13 L37 16" fill="#d6a39b" opacity=".8"/><path d="M22 11 L23 16 M27 11 L27 15" stroke="${line}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>${sleepy ? '<path d="M14 22 Q17 25 19 22 M30 22 Q33 25 35 22" stroke="#625e51" fill="none" stroke-width="1.7"/>' : '<ellipse cx="17" cy="23" rx="1.7" ry="2.2" fill="#57564a"/><ellipse cx="32" cy="23" rx="1.7" ry="2.2" fill="#57564a"/>'}<path d="M23 27 L26 27 L24.5 29 Z" fill="#a5776d"/><path d="M24.5 29 Q21 33 20 29 M24.5 29 Q28 33 29 29" stroke="#7e7462" stroke-width="1" fill="none"/><ellipse cx="12" cy="27" rx="3" ry="1.6" fill="#e6a39c" opacity=".6"/><ellipse cx="37" cy="27" rx="3" ry="1.6" fill="#e6a39c" opacity=".6"/></g></g>`;
}
