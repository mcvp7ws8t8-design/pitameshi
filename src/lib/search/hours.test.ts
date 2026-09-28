import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenAt, parseOpenHours } from "./hours";

/** 日本時間の日時(2026-09-28 は月曜日) */
const jst = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`);
const MON = "2026-09-28";
const TUE = "2026-09-29";
const SAT = "2026-10-03";
const SUN = "2026-10-04";

test("parseOpenHours: 曜日の範囲と複数の時間帯", () => {
  const segs = parseOpenHours("月～金: 11:30～14:00 （料理L.O. 13:30）17:00～23:00 土、日、祝日: 11:00～22:00");
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0]!.days.sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(segs[0]!.ranges, [
    [690, 840],
    [1020, 1380],
  ]);
  assert.deepEqual(segs[1]!.days.sort(), [0, 6]);
});

test("parseOpenHours: 曜日の記載がなければ毎日", () => {
  const segs = parseOpenHours("11:00～21:00");
  assert.deepEqual(segs, [{ days: [0, 1, 2, 3, 4, 5, 6], ranges: [[660, 1260]] }]);
});

test("parseOpenHours: 読めない記載は空", () => {
  assert.deepEqual(parseOpenHours("お問い合わせください"), []);
  assert.deepEqual(parseOpenHours(undefined), []);
});

test("isOpenAt: 昼と夜の間は閉まっている", () => {
  const open = "月～金: 11:30～14:00 17:00～23:00";
  assert.equal(isOpenAt(open, "", jst(MON, "12:00")), true);
  assert.equal(isOpenAt(open, "", jst(MON, "15:00")), false);
  assert.equal(isOpenAt(open, "", jst(MON, "22:59")), true);
  assert.equal(isOpenAt(open, "", jst(MON, "23:00")), false);
});

test("isOpenAt: 深夜営業は翌日の早朝まで営業中", () => {
  const open = "月～土: 17:00～翌2:00 日: 17:00～23:00";
  assert.equal(isOpenAt(open, "", jst(TUE, "01:30")), true); // 月曜の続き
  assert.equal(isOpenAt(open, "", jst(TUE, "02:30")), false);
  assert.equal(isOpenAt(open, "", jst("2026-10-05", "01:00")), false); // 日曜は23時まで
});

test("isOpenAt: 「翌」が省略された深夜営業", () => {
  assert.equal(isOpenAt("18:00～3:00", "", jst(MON, "02:00")), true);
});

test("isOpenAt: 全角の数字とコロン", () => {
  assert.equal(isOpenAt("月～日：１１：００～２２：００", "", jst(SAT, "11:00")), true);
});

test("isOpenAt: 記載のない曜日は定休日なら休み、それ以外は不明", () => {
  const open = "月～土: 11:00～22:00";
  assert.equal(isOpenAt(open, "日曜日", jst(SUN, "12:00")), false);
  assert.equal(isOpenAt(open, "不定休", jst(SUN, "12:00")), undefined);
});

test("isOpenAt: 「定休日:」の「日」を日曜と読まない", () => {
  const segs = parseOpenHours("月～金: 10:00～18:00 定休日: 土日");
  assert.equal(segs.length, 1);
});

test("isOpenAt: 営業時間が読めなければ不明", () => {
  assert.equal(isOpenAt("", "", jst(MON, "12:00")), undefined);
});
