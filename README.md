# BSC Holder Intelligence UI

Bu klasorde BSC token holder analizi icin statik bir dashboard mockup var.

## Icerik

- `index.html`: Ana arayuz
- `styles.css`: Tasarim sistemi ve responsive duzen
- `app.js`: Demo veri ve etkilesimler

## Amac

Bu ekran su sorulari tek panelde cevaplamak icin tasarlandi:

- Holderlar tokeni hangi route veya kontrattan aldi?
- Top holder yuzdelik olarak kimde yogunlasiyor?
- Adres etiketleri varsa kimlere ait?
- Likidite, locker, team wallet ve retail holder ayrimi nasil gorunuyor?
- Deployer iliskili veya bundle/suspicious cluster var mi?

## Kullanim

`index.html` dosyasini tarayicida acman yeterli.

## Env

- Lokal anahtar dosyasi: `.env`
- Paylasilabilir ornek: `.env.example`
- `.env` dosyasi `.gitignore` icinde, repo'ya gitmez.

Not: Bu proje su an saf frontend oldugu icin `.env` tarayicida dogrudan kullanilmaz. Moralis anahtarini guvenli kullanmak icin bir backend/proxy katmani gerekir.

## Sonraki adim

Gercek veri baglamak istersen su veri kaynaklari eklenebilir:

- Holder listesi: BscScan API, Bitquery, Covalent, Moralis
- Transfer route analizi: token transfer events + pair/router decode
- Etiketleme: BscScan labels, Arkham, Nansen, internal entity registry
- Likidite ayrimi: pair contracts, LP locker contracts, burn addresses
