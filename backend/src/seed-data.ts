import { type CardRecord, type Merchant } from "./types.js";

export const seedMerchants: Merchant[] = [
  { id: "amazon", name: "Amazon", category: "EC", isActive: true },
  { id: "rakuten-ichiba", name: "楽天市場", category: "EC", isActive: true },
  { id: "seven-eleven", name: "セブン-イレブン", category: "コンビニ", isActive: true },
  { id: "familymart", name: "ファミリーマート", category: "コンビニ", isActive: true },
  { id: "lawson", name: "ローソン", category: "コンビニ", isActive: true },
  { id: "aeon", name: "イオン", category: "スーパー", isActive: true },
  { id: "eneos", name: "ENEOS", category: "ガソリン", isActive: true },
  { id: "yodobashi-camera", name: "ヨドバシカメラ", category: "家電", isActive: true },
  { id: "bic-camera", name: "ビックカメラ", category: "家電", isActive: true },
  { id: "starbucks", name: "スターバックス", category: "カフェ", isActive: true },
  { id: "uniqlo", name: "ユニクロ", category: "ファッション", isActive: true },
  { id: "gu", name: "GU", category: "ファッション", isActive: true },
  { id: "apple", name: "Apple", category: "デジタル", isActive: true },
  { id: "google-play", name: "Google Play", category: "デジタル", isActive: true },
  { id: "docomo", name: "docomo", category: "通信", isActive: true },
  { id: "softbank", name: "SoftBank", category: "通信", isActive: true }
];

export const seedCards: CardRecord[] = [
  {
    id: "sakura-basic",
    name: "Sakura Basic",
    issuer: "Sakura Card",
    description: "年会費無料で、EC とコンビニを広くカバーする標準カードです。",
    annualFeeYen: 0,
    baseRewardRatePct: 1.0,
    supportedBrands: ["Visa", "Mastercard"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "amazon", rewardRatePct: 1.6, note: "EC 優待", isActive: true },
      { merchantId: "rakuten-ichiba", rewardRatePct: 1.5, note: "EC 優待", isActive: true },
      { merchantId: "seven-eleven", rewardRatePct: 1.3, note: "日常優待", isActive: true },
      { merchantId: "familymart", rewardRatePct: 1.3, note: "日常優待", isActive: true }
    ]
  },
  {
    id: "machi-plus",
    name: "Machi Plus",
    issuer: "Machi Finance",
    description: "コンビニとカフェ利用に寄せたポイント重視カードです。",
    annualFeeYen: 0,
    baseRewardRatePct: 1.2,
    supportedBrands: ["Mastercard", "JCB"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "seven-eleven", rewardRatePct: 2.8, note: "コンビニ優待", isActive: true },
      { merchantId: "familymart", rewardRatePct: 2.8, note: "コンビニ優待", isActive: true },
      { merchantId: "lawson", rewardRatePct: 2.8, note: "コンビニ優待", isActive: true },
      { merchantId: "starbucks", rewardRatePct: 2.1, note: "カフェ優待", isActive: true }
    ]
  },
  {
    id: "ec-max-gold",
    name: "EC Max Gold",
    issuer: "Digital Axis",
    description: "EC とデジタル課金で強い上位カードです。",
    annualFeeYen: 11000,
    baseRewardRatePct: 1.5,
    supportedBrands: ["Visa", "Mastercard", "JCB"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "amazon", rewardRatePct: 3.8, note: "EC 特化", isActive: true },
      { merchantId: "rakuten-ichiba", rewardRatePct: 2.2, note: "EC 特化", isActive: true },
      { merchantId: "apple", rewardRatePct: 2.5, note: "デジタル特典", isActive: true },
      { merchantId: "google-play", rewardRatePct: 2.5, note: "デジタル特典", isActive: true }
    ]
  },
  {
    id: "daily-jcb-select",
    name: "Daily JCB Select",
    issuer: "Select Card",
    description: "スーパーとアパレル向けのコスト重視カードです。",
    annualFeeYen: 0,
    baseRewardRatePct: 0.9,
    supportedBrands: ["JCB"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "aeon", rewardRatePct: 2.0, note: "スーパー優待", isActive: true },
      { merchantId: "uniqlo", rewardRatePct: 1.8, note: "衣料優待", isActive: true },
      { merchantId: "gu", rewardRatePct: 1.8, note: "衣料優待", isActive: true }
    ]
  },
  {
    id: "fuel-drive",
    name: "Fuel Drive",
    issuer: "Drive Point",
    description: "車移動が多い人向けにガソリンと家電をカバーします。",
    annualFeeYen: 2200,
    baseRewardRatePct: 1.1,
    supportedBrands: ["Visa", "Mastercard"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "eneos", rewardRatePct: 3.0, note: "ガソリン優待", isActive: true },
      { merchantId: "bic-camera", rewardRatePct: 1.8, note: "家電優待", isActive: true }
    ]
  },
  {
    id: "smartlife-amex",
    name: "SmartLife Amex",
    issuer: "SmartLife",
    description: "デジタル課金とカフェ利用をまとめたい人向けです。",
    annualFeeYen: 6600,
    baseRewardRatePct: 1.4,
    supportedBrands: ["Amex"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "apple", rewardRatePct: 3.0, note: "デジタル優待", isActive: true },
      { merchantId: "google-play", rewardRatePct: 3.0, note: "デジタル優待", isActive: true },
      { merchantId: "starbucks", rewardRatePct: 2.4, note: "カフェ優待", isActive: true }
    ]
  },
  {
    id: "telecom-balance",
    name: "Telecom Balance",
    issuer: "Balance Card",
    description: "通信費と EC を一枚に寄せたい人向けの無料カードです。",
    annualFeeYen: 0,
    baseRewardRatePct: 1.0,
    supportedBrands: ["Visa", "JCB"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "docomo", rewardRatePct: 2.5, note: "通信優待", isActive: true },
      { merchantId: "softbank", rewardRatePct: 2.5, note: "通信優待", isActive: true },
      { merchantId: "amazon", rewardRatePct: 1.4, note: "EC 優待", isActive: true }
    ]
  },
  {
    id: "shopping-premium",
    name: "Shopping Premium",
    issuer: "Premium Line",
    description: "家電とファッションのまとめ買いを想定したカードです。",
    annualFeeYen: 5500,
    baseRewardRatePct: 1.6,
    supportedBrands: ["Visa", "Mastercard", "Amex"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "yodobashi-camera", rewardRatePct: 3.0, note: "家電優待", isActive: true },
      { merchantId: "bic-camera", rewardRatePct: 3.0, note: "家電優待", isActive: true },
      { merchantId: "uniqlo", rewardRatePct: 2.0, note: "衣料優待", isActive: true }
    ]
  },
  {
    id: "green-family",
    name: "Green Family",
    issuer: "Green Bank",
    description: "日用品の継続利用に向いた年会費無料カードです。",
    annualFeeYen: 0,
    baseRewardRatePct: 1.1,
    supportedBrands: ["Visa", "Mastercard"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "aeon", rewardRatePct: 2.4, note: "生活圏優待", isActive: true },
      { merchantId: "seven-eleven", rewardRatePct: 1.5, note: "日常優待", isActive: true },
      { merchantId: "lawson", rewardRatePct: 1.5, note: "日常優待", isActive: true }
    ]
  },
  {
    id: "travel-axis-gold",
    name: "Travel Axis Gold",
    issuer: "Axis Rewards",
    description: "高単価利用向けに一般還元率を高めたカードです。",
    annualFeeYen: 13200,
    baseRewardRatePct: 1.8,
    supportedBrands: ["Visa", "Amex"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "starbucks", rewardRatePct: 2.2, note: "ラウンジ前提の生活圏特典", isActive: true },
      { merchantId: "apple", rewardRatePct: 2.0, note: "デジタル特典", isActive: true }
    ]
  },
  {
    id: "point-core-standard",
    name: "Point Core Standard",
    issuer: "Point Core",
    description: "広いブランド対応はないものの、無料で高めの基本還元率を提供します。",
    annualFeeYen: 0,
    baseRewardRatePct: 1.3,
    supportedBrands: ["Mastercard"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "amazon", rewardRatePct: 1.8, note: "EC 優待", isActive: true },
      { merchantId: "rakuten-ichiba", rewardRatePct: 1.8, note: "EC 優待", isActive: true },
      { merchantId: "google-play", rewardRatePct: 2.0, note: "デジタル優待", isActive: true }
    ]
  },
  {
    id: "metro-jcb-premium",
    name: "Metro JCB Premium",
    issuer: "Metro Finance",
    description: "JCB 希望で日常利用をまとめたい人向けのプレミアム帯です。",
    annualFeeYen: 8800,
    baseRewardRatePct: 1.5,
    supportedBrands: ["JCB", "Amex"],
    isActive: true,
    merchantBenefitRates: [
      { merchantId: "seven-eleven", rewardRatePct: 2.2, note: "コンビニ優待", isActive: true },
      { merchantId: "lawson", rewardRatePct: 2.2, note: "コンビニ優待", isActive: true },
      { merchantId: "yodobashi-camera", rewardRatePct: 2.4, note: "家電優待", isActive: true },
      { merchantId: "docomo", rewardRatePct: 1.9, note: "通信優待", isActive: true }
    ]
  }
];
