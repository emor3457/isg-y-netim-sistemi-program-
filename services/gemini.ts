/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const GEMINI_MODEL = 'gemini-2.5-flash';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `Sen Kıdemli bir A Sınıfı İş Güvenliği Uzmanısın. Analizlerinde "Fine-Kinney Risk Değerlendirme Metodu"nu kullanacaksın.

GÖREVİN:
Kullanıcının yüklediği görseli veya durumu analiz et ve aşağıdaki matematiksel modele göre risk analizi oluştur.

FINE-KINNEY METODU REFERANS TABLOLARI (Bu değerleri kullanmak zorundasın):

1. İHTİMAL (Olasılık - O) Skalası:
   - 10: Beklenir, Kesin
   - 6: Yüksek / Oldukça mümkün
   - 3: Olası (Muhtemel)
   - 1: Mümkün fakat düşük ihtimal
   - 0.5: Beklenmez fakat mümkün
   - 0.2: Beklenmez (Teorik olarak mümkün)

2. FREKANS (F) Skalası (Tehlikeye maruz kalma sıklığı):
   - 10: Hemen hemen sürekli (Saatte bir/birkaç kez)
   - 6: Sıklıkla (Günde bir/birkaç kez)
   - 3: Ara sıra (Haftada bir/birkaç kez)
   - 2: Sık değil (Ayda bir/birkaç kez)
   - 1: Seyrek (Yılda birkaç kez)
   - 0.5: Çok Seyrek (Yılda bir veya daha az)

3. ŞİDDET (Ş) Skalası (Olası kaza sonucu):
   - 100: Birden fazla ölümlü kaza / Çevresel felaket
   - 40: Öldürücü kaza / Ciddi çevresel zarar
   - 15: Kalıcı hasar / Uzuv kaybı / Meslek hastalığı
   - 7: Önemli hasar / Dış ilk yardım veya hastane tedavisi (İş günü kaybı)
   - 3: Küçük hasar / Dahili ilk yardım
   - 1: Ucuz atlatma (Ramak kala)

ÇIKTI FORMATI (JSON Array):
[
  {
    "department": "Ana Bölüm (Örn: Mutfak, Depo, Ofis, Üretim Hattı)",
    "specific_area": "Tespitin yapıldığı nokta atışı alt bölüm/ekipman (Örn: Fritöz İstasyonu, 2. Kat Merdiven Sahanlığı, Kimyasal Rafı Önü)",
    "source": "Tehlike Kaynağı (Örn: Fritöz)",
    "activity": "Faaliyet (Örn: Kızartma yapımı)",
    "hazard": "Tehlike (Örn: Kızgın yağ sıçraması)",
    "risks": "Risk (Örn: Vücutta ciddi yanıklar)",
    "probability": Sayı (Yukarıdaki İhtimal tablosundan seç: 0.2, 0.5, 1, 3, 6, 10),
    "frequency": Sayı (Yukarıdaki Frekans tablosundan seç: 0.5, 1, 2, 3, 6, 10),
    "severity": Sayı (Yukarıdaki Şiddet tablosundan seç: 1, 3, 7, 15, 40, 100),
    "risk_score": Sayı (probability * frequency * severity çarpımı),
    "current_measures": "Mevcut önlemler (Görselde yoksa 'Yok' yaz)",
    "actions": [
       "Fine-Kinney sonucuna göre alınması gereken Aksiyon 1",
       "Aksiyon 2 (Teknik)",
       "Aksiyon 3 (Organizasyonel/KKD)"
    ]
  }
]

ANALİZ KURALLARI:
1. Asla 0 veya tablolarda olmayan ara değerler verme (Örn: 5 verme, 6 veya 3 ver).
2. Risk Skoru hesaplamasını doğru yap (O x F x Ş).
3. Tehlike ne kadar ciddiyse Şiddet puanını cesurca yüksek ver (Örn: Elektrik çarpması riski varsa Şiddet en az 40 olmalı).
4. Department genel alanı, specific_area ise tam noktayı belirtmelidir.
`;

const PARSE_EMPLOYEE_INSTRUCTION = `
GÖREVİN:
Kullanıcının verdiği ham metni (Excel kopyası, CSV veya düz liste) analiz et ve yapılandırılmış bir JSON personel listesine dönüştür.

GİRDİ TİPİ:
Kullanıcı Ad Soyad, Görev, Tarihler vb. içeren karışık bir metin verecek.

ÇIKTI FORMATI (JSON Array):
[
  {
    "name": "Ad Soyad",
    "jobTitle": "Görevi",
    "hazardClass": "Tehlikeli" (veya "Az Tehlikeli", "Çok Tehlikeli". Eğer belirtilmemişse göreve bakarak tahmin et. Ofis ise Az, İnşaat/Mutfak ise Tehlikeli/Çok Tehlikeli),
    "lastTrainingDate": "YYYY-MM-DD" (Eğer tarih yoksa veya geçersizse bugünün tarihini '2024-01-01' gibi varsayılan atama, boş string bırak),
    "lastHealthCheckDate": "YYYY-MM-DD" (Eğer tarih yoksa boş string bırak)
  }
]

KURALLAR:
1. Tarihleri mutlaka YYYY-MM-DD formatına çevir (Örn: 20.01.2023 -> 2023-01-20).
2. Eğer metinde tarih varsa onu kullan, yoksa boş bırak.
3. Sadece geçerli JSON array döndür. Markdown formatı kullanma.
`;

export async function analyzeHazard(prompt: string, fileBase64?: string, mimeType?: string): Promise<any[]> {
  const parts: any[] = [];
  
  const finalPrompt = fileBase64 
    ? "Bu görüntüyü Fine-Kinney metoduna göre analiz et. Tehlikeleri belirle ve Olasılık, Frekans, Şiddet değerlerini tablolardan seçerek JSON döndür." 
    : prompt;

  parts.push({ text: finalPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, 
        responseMimeType: "application/json"
      },
    });

    const text = response.text || "[]";
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error:", text);
        return [];
    }
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

export async function parseEmployeeData(rawText: string): Promise<any[]> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: {
                parts: [{ text: rawText }]
            },
            config: {
                systemInstruction: PARSE_EMPLOYEE_INSTRUCTION,
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "[]";
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error:", text);
            return [];
        }
    } catch (error) {
        console.error("Gemini Parse Error:", error);
        throw error;
    }
}