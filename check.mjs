// node check.mjs - 키와 표를 확인한다. "키 OK" 와 "표 OK" 두 줄이 나와야 다음으로 간다.
import { readFileSync } from "node:fs";

function loadEnv() {
  let txt = "";
  try { txt = readFileSync(new URL("./.env", import.meta.url), "utf-8"); }
  catch { return {}; }
  const out = {};
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("키 없음 - .env 에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 채우세요.");
  process.exit(1);
}
if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
  console.log("키 없음 - VITE_SUPABASE_URL 이 https://xxxx.supabase.co 형태가 아닙니다.");
  process.exit(1);
}
console.log("키 OK");

const r = await fetch(`${url}/rest/v1/bookings?select=id&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).catch((e) => ({ ok: false, status: 0, _err: e.message }));

if (r.status === 200) {
  console.log("표 OK");
  process.exit(0);
}
if (r.status === 404 || r.status === 400) {
  console.log("표 없음 - _table.sql 을 Supabase SQL Editor 에 붙여넣고 Run 하세요.");
  process.exit(1);
}
if (r.status === 401 || r.status === 403) {
  console.log("키 없음 - anon 키가 이 프로젝트의 것이 맞는지 확인하세요.");
  process.exit(1);
}
if (r.status === 0) {
  console.log("주소 못 찾음 - VITE_SUPABASE_URL 을 다시 봅니다. Supabase 대시보드의");
  console.log("  Settings -> API -> Project URL 을 그대로 복사했는지, 오타가 없는지 확인하세요.");
  process.exit(1);
}
console.log(`확인 실패 - status ${r.status}${r._err ? " / " + r._err : ""}`);
process.exit(1);
