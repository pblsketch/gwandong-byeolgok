'use strict';
// 배경음 파일(선생님이 고쳐도 되는 파일)
//  - 곡 이름은 js/core/audio.js의 TRACKS와 같다. 여기 있는 곡은 파일을 틀고, 없거나 못 읽으면 합성음을 튼다.
//  - 음원: 국립국악원 디지털 이음 「국악기 디지털 음원」 악구 — 공공누리 제1유형(출처표시).
//    한 연주를 번호 순서대로 잘게 나눈 악구를 순서대로 이어 붙이고, 끝과 처음을 겹쳐 되풀이해도 이음매가 없게 했다.
//  - gain: 곡마다 소리 크기(1이 기본). 모든 곡을 같은 크기(-17 LUFS)로 맞춰 두었다.
window.BGM = {
  credit: '배경음: 국립국악원 「디지털 이음」 국악기 악구(공공누리 제1유형)를 이어 붙였어요',
  tracks: {
    title: { src: 'assets/bgm/title.mp3', from: '거문고 산조 — 중모리' },          // 서장·제목: 선비의 악기 거문고
    journey: { src: 'assets/bgm/journey.mp3', from: '가야금 경기민요 — 천안삼거리·한강수타령·창부타령' }, // 1장 부임길
    mountain: { src: 'assets/bgm/mountain.mp3', from: '가야금 산조 — 중중모리' },  // 2장 내금강
    sea: { src: 'assets/bgm/sea.mp3', from: '가야금 경기민요 — 도라지·아리랑' },     // 3장 관동팔경
    storm: { src: 'assets/bgm/storm.mp3', from: '거문고 산조 — 엇모리' },          // 4장 망양정: 성난 바다
    boss: { src: 'assets/bgm/boss.mp3', from: '태평소 시나위 — 자진모리' },         // 보스
    night: { src: 'assets/bgm/night.mp3', from: '대금 산조 — 진양조' },            // 해돋이 기다림·달밤
    sad: { src: 'assets/bgm/night.mp3', from: '대금 산조 — 진양조' },
    dream: { src: 'assets/bgm/dream.mp3', from: '소금 연례악 — 수제천' },          // 꿈: 신선과 한 잔
  },
};
