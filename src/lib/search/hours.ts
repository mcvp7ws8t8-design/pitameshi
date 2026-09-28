import type { TriState } from "./interpret";

/**
 * 「今営業中」(リリース3)。店舗データの営業時間(open)・定休日(close)の自由記述を解析する。
 * 例: 「月～金、祝前日: 17:00～翌3:00 (料理L.O. 翌2:00)土、日: 16:00～23:00」
 * 祝日は暦を持っていないので判定に使わない(祝日だけの記載は無視)。精度に限界があるため、
 * 読めない店は「不明」にして、利用者が「不明の店も含める」で選べるようにする(U-07)。
 */

/** 日曜=0 … 土曜=6(Date#getDay と同じ) */
const DAY_CHARS = "日月火水木金土";
/** 表記の並び(「月～金」の範囲を展開するため) */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type OpenSegment = { days: number[]; ranges: [number, number][] };

function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ":")
    .replace(/[〜~－-]/g, "～")
    .replace(/[（(][^）)]*[）)]/g, " ") // L.O. などの補足を外す
    .replace(/\s+/g, " ");
}

function expandDays(spec: string): number[] {
  const days = new Set<number>();
  for (const part of spec.split(/[、,・/\s]+/)) {
    const range = part.match(/^([日月火水木金土])(?:曜日?)?～([日月火水木金土])/);
    if (range) {
      const from = WEEK_ORDER.indexOf(DAY_CHARS.indexOf(range[1]!));
      const to = WEEK_ORDER.indexOf(DAY_CHARS.indexOf(range[2]!));
      for (let i = from; ; i = (i + 1) % 7) {
        days.add(WEEK_ORDER[i]!);
        if (i === to) break;
      }
      continue;
    }
    // 「祝日」「祝前日」は暦がないので使わない。「日」だけの語(日曜)は拾う
    if (/^祝/.test(part)) continue;
    const single = part.match(/^([日月火水木金土])(?:曜日?)?$/);
    if (single) days.add(DAY_CHARS.indexOf(single[1]!));
  }
  return [...days];
}

const TIME_RANGE = /(翌)?(\d{1,2}):(\d{2})\s*～\s*(翌)?(\d{1,2}):(\d{2})/g;

function parseRanges(body: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of body.matchAll(TIME_RANGE)) {
    let start = Number(m[2]) * 60 + Number(m[3]) + (m[1] ? 1440 : 0);
    let end = Number(m[5]) * 60 + Number(m[6]) + (m[4] ? 1440 : 0);
    if (start >= 1440 && !m[1]) continue;
    if (end <= start) end += 1440; // 「17:00～2:00」のように翌が省略されている
    if (start >= 1440) {
      // 「翌1:00～翌5:00」は前日の続きとして扱う
      start -= 1440;
      end -= 1440;
      if (end <= start) continue;
    }
    out.push([start, Math.min(end, start + 1440)]);
  }
  return out;
}

/** 曜日の見出し(「月～金、祝前日:」など)で区切る */
const HEADER = /(?<![\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])((?:(?:[日月火水木金土](?:曜日?)?|祝日|祝前日|祝後日|祝)\s*[～、,・/]?\s*)+)\s*:/gu;

export function parseOpenHours(open: string | undefined | null): OpenSegment[] {
  if (!open) return [];
  const text = normalize(open);
  const headers = [...text.matchAll(HEADER)];
  if (headers.length === 0) {
    const ranges = parseRanges(text);
    return ranges.length ? [{ days: [0, 1, 2, 3, 4, 5, 6], ranges }] : [];
  }
  const segments: OpenSegment[] = [];
  headers.forEach((h, i) => {
    const bodyStart = h.index! + h[0].length;
    const bodyEnd = headers[i + 1]?.index ?? text.length;
    const days = expandDays(h[1]!.trim());
    const ranges = parseRanges(text.slice(bodyStart, bodyEnd));
    if (days.length && ranges.length) segments.push({ days, ranges });
  });
  return segments;
}

/** 定休日の記載に曜日が含まれるか(「日曜日」「毎週月曜」など。「不定休」「無休」は含まない) */
function closedOn(close: string | undefined | null, day: number): boolean {
  if (!close) return false;
  const text = normalize(close).replace(/祝[前後]?日?/g, "");
  if (/(無休|年中無休|不定休)/.test(text)) return false;
  return new RegExp(`${DAY_CHARS[day]}(曜|$|[、,・\\s])`).test(text);
}

/** 日本時間の曜日と、0時からの分 */
export function japanTime(now: Date): { day: number; minutes: number } {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  return { day: jst.getUTCDay(), minutes: jst.getUTCHours() * 60 + jst.getUTCMinutes() };
}

/**
 * その時刻に営業中か。true / false / undefined(判定できない)。
 * 前日の深夜営業(「翌2:00まで」)も見る。
 */
export function isOpenAt(open: string | undefined | null, close: string | undefined | null, now: Date): TriState {
  const segments = parseOpenHours(open);
  if (segments.length === 0) return undefined;
  const { day, minutes } = japanTime(now);
  const yesterday = (day + 6) % 7;

  let todayKnown = false;
  for (const seg of segments) {
    if (seg.days.includes(day)) {
      todayKnown = true;
      if (seg.ranges.some(([s, e]) => minutes >= s && minutes < e)) return true;
    }
    if (seg.days.includes(yesterday) && seg.ranges.some(([, e]) => e > 1440 && minutes + 1440 < e)) return true;
  }
  if (todayKnown) return false;
  // 今日の曜日の記載がない:定休日に書いてあれば休み、なければ判定できない(祝日だけの営業など)
  return closedOn(close, day) ? false : undefined;
}
