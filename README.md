---
title: Detektif Data Backend
emoji: 🦉
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# 🦉 Server Backend & Database Data Game Relasi & Fungsi (Thesis S2)

Server backend mandiri untuk Game Edukasi Matematika *Detektif Relo & Snowy: Petualangan Relasi & Fungsi*.
Server ini bertugas untuk:
1. **Pendaftaran & Autentikasi Siswa** (Nama Lengkap, Username, Password terenkripsi).
2. **Pencatatan Kemajuan Belajar**:
   - Subbab/Bab 1 sampai 7 yang dikerjakan.
   - Stage 1 sampai 21 serta bintang perolehan.
3. **Pencatatan Nilai Ujian Quest Mode (Data Inti Tesis)**:
   - Nilai Ujian skala 0–100 untuk Bab 1 sampai 7.
   - Jumlah soal benar & total soal (30 soal per bab).
   - Waktu pengerjaan dan sisa waktu (speed bonus).
4. **Pencatatan Skor Endless Mode & Total Skor Game**.
5. **Panel Admin & Fitur Ekspor Excel (.CSV)** untuk analisis statistik skripsi/tesis (kompatibel SPSS / Excel).

---

## 🚀 Cara Menjalankan Server Secara Lokal

1. **Install Dependensi**:
   ```bash
   npm install
   ```

2. **Jalankan Mode Development**:
   ```bash
   npm run dev
   ```
   Server akan berjalan di `http://localhost:3001`.
   File database SQLite `detektif_data.db` akan dibuat otomatis di folder ini.

3. **Buka Panel Admin / Rekap Nilai**:
   Akses di browser:
   ```
   http://localhost:3001/admin
   ```
   Kamu bisa melihat tabel nilai seluruh siswa secara langsung dan klik tombol **"Download Rekap Excel (.CSV)"**!

---

## ☁️ Panduan Deploy ke Internet (Gratis & Mudah)

### Pilihan 1: Deploy ke Railway.app (Paling Direkomendasikan)
1. Buat akun di [railway.app](https://railway.app).
2. Upload folder ini ke repository GitHub baru (misal: `data-deploy-relasi-fungsi`).
3. Di dashboard Railway, klik **New Project** -> **Deploy from GitHub repo** -> pilih repo tersebut.
4. Tambahkan **Volume Disk** (untuk menyimpan file `detektif_data.db` agar data siswa tidak hilang saat restart):
   - Klik tab **Volumes** -> **Add Volume** -> Mount path: `/app`.
5. Railway akan otomatis mendeteksi `Dockerfile` dan menjalankan server.
6. Masuk ke tab **Settings** -> **Generate Domain** (kamu akan mendapat domain HTTPS publik, contoh: `https://data-relasi-fungsi-production.up.railway.app`).

### Pilihan 2: Deploy ke Render.com
1. Buat akun di [render.com](https://render.com).
2. Klik **New +** -> **Web Service** -> hubungkan repo GitHub.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Atur Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `HOST`: `0.0.0.0`

---

## 🔗 Menghubungkan Game Frontend ke Server Ini

Setelah server kamu live dan memiliki domain publik (misal: `https://api-kamu.up.railway.app`):
1. Buka project game frontend (`Game-Relasi-Fungsi`).
2. Buka file `.env` di game:
   ```env
   VITE_API_URL=https://api-kamu.up.railway.app
   ```
3. Build ulang game atau deploy frontend game ke Vercel:
   ```bash
   npm run build
   ```
4. Selesai! Semua siswa yang memainkan game (baik lewat Web browser, Android APK, atau PC) datanya akan langsung masuk ke server cloud ini dan dapat kamu download di halaman `/admin`.
