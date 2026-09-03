import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// .env 파일 읽기
const envPath = path.join('.', '.env')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key.trim()] = value.trim()
  }
})

const supabaseUrl = envVars.VITE_SUPABASE_URL
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 환경 변수 누락:', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey })
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('🔍 Supabase 연결 테스트...')
console.log('URL:', supabaseUrl)

// 1. 테이블 존재 확인
console.log('\n📋 bookings 테이블 조회...')
const { data, error } = await supabase
  .from('bookings')
  .select('*')
  .limit(1)

if (error) {
  console.error('❌ 오류:', error.code, error.message)
  console.error('   details:', error.details)
  process.exit(1)
}

console.log('✅ 성공! 데이터:', data)

// 2. 모든 행 조회
console.log('\n📊 전체 데이터 조회...')
const { data: allData, error: allError } = await supabase
  .from('bookings')
  .select('id, customer, service, date, time, status, address, created_at')
  .order('created_at', { ascending: false })

if (allError) {
  console.error('❌ 오류:', allError.code, allError.message)
} else {
  console.log(`✅ ${allData.length}개 행 조회됨`)
  allData.forEach(row => {
    console.log(`   - ID ${row.id}: ${row.customer} (${row.date} ${row.time})`)
  })
}
