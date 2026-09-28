"use client";

import { useSyncExternalStore } from "react";

/**
 * localStorage の値を React から読む。別タブでの変更(storage イベント)と、
 * このタブでの writeStored にも追従する。サーバー描画時と、読めない環境では null。
 */
const LOCAL_EVENT = "pitameshi:storage";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_EVENT, callback);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return ""; // プライベートモードなどで使えないときは「空」として扱う
  }
}

/** 戻り値:null = まだ読んでいない(サーバー描画・初回)、"" = 保存なし、それ以外 = 保存された文字列 */
export function useStoredRaw(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}

export function readStored(key: string): string | null {
  return typeof window === "undefined" ? null : read(key);
}

export function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 保存できなくても画面の操作は続ける */
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
