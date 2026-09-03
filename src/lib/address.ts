/**
 * Nominatim 이 주는 주소를 한국식 순서로 다시 만든다.
 *
 * Nominatim 의 display_name 은 좁은 단위부터 늘어놓는 서양식이라
 * 네비에 찍거나 남에게 알려주기에 불편하다.
 *
 *   받는 값: "YG 엔터테인먼트, 3, 희우정로1길, 합정동, 마포구, 서울특별시, 04028, 대한민국"
 *   만드는 값: "서울특별시 마포구 희우정로1길 3"
 *
 * address 객체가 없으면 display_name 을 그대로 쓰되, 우편번호와 국가명만 떼어낸다.
 */

/** Nominatim 의 address 객체. 지역마다 채워지는 칸이 달라 전부 선택 항목이다. */
export interface NominatimAddress {
  city?: string
  province?: string
  state?: string
  borough?: string
  county?: string
  city_district?: string
  town?: string
  village?: string
  suburb?: string
  quarter?: string
  neighbourhood?: string
  road?: string
  house_number?: string
  amenity?: string
  building?: string
  shop?: string
  tourism?: string
  postcode?: string
  country?: string
}

/** 시·도 (서울특별시, 경기도 …) */
function pickRegion(a: NominatimAddress) {
  return a.city || a.province || a.state || ''
}

/** 시·군·구 (마포구, 성남시 …) */
function pickDistrict(a: NominatimAddress, region: string) {
  const candidate = a.borough || a.city_district || a.county || a.town || a.village || ''
  // "서울특별시"가 시·도와 시·군·구 양쪽에 잡히는 경우가 있어 중복을 걸러낸다.
  return candidate && candidate !== region ? candidate : ''
}

/** 도로명 + 건물번호 (희우정로1길 3) */
function pickStreet(a: NominatimAddress) {
  if (!a.road) return ''
  return a.house_number ? `${a.road} ${a.house_number}` : a.road
}

/** 장소 이름 (YG 엔터테인먼트, 하이브 …) */
function pickPlaceName(a: NominatimAddress) {
  return a.amenity || a.building || a.shop || a.tourism || ''
}

/** display_name 밖에 없을 때 쓰는 최소 정리 */
function fallback(displayName: string) {
  return displayName
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '대한민국' && !/^\d{5}$/.test(part))
    .reverse()
    .join(' ')
}

export function formatKoreanAddress(
  address: NominatimAddress | undefined,
  displayName: string,
): string {
  if (!address || typeof address !== 'object') {
    return fallback(displayName)
  }

  const region = pickRegion(address)
  const district = pickDistrict(address, region)
  const street = pickStreet(address)
  const place = pickPlaceName(address)

  // 넓은 단위 -> 좁은 단위 순서로 이어 붙인다.
  const parts = [region, district, street].filter(Boolean)

  // 도로명을 못 찾았으면 동네 이름이라도 넣어 빈 주소가 되지 않게 한다.
  if (!street) {
    const area = address.suburb || address.quarter || address.neighbourhood || ''
    if (area && area !== district) parts.push(area)
  }

  if (parts.length === 0) return fallback(displayName)

  const base = parts.join(' ')

  // 건물 이름은 뒤에 괄호로 덧붙인다. 주소 순서를 흐트러뜨리지 않는다.
  return place && !base.includes(place) ? `${base} (${place})` : base
}
