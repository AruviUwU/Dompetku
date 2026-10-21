import os
import base64
import asyncio
import discord
from discord import app_commands
from dotenv import load_dotenv
import httpx
from main import process_message
from database import get_user_id_from_discord, get_server_channel, set_server_channel, remove_server_channel

load_dotenv()

intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")

BOT_API_SECRET = os.getenv("BOT_API_SECRET")
APP_URL = os.getenv("APP_URL", "https://dompetku.vercel.app")


@client.event
async def on_ready():
    await tree.sync()
    print(f"✅ Bot Discord Dompetku aktif sebagai {client.user}")
    print(f"   Slash commands synced. APP_URL = {APP_URL}")


# ── /link — Hubungkan akun Discord ke Dompetku Web ──────────────────────────
@tree.command(name="link", description="Hubungkan akun Discord ke Dompetku Web")
async def link_command(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    discord_id = str(interaction.user.id)

    try:
        # Cek apakah sudah terhubung
        existing = get_user_id_from_discord(discord_id)
        if existing:
            await interaction.followup.send(
                "✅ Akun Discord kamu sudah terhubung ke Dompetku! Langsung kirim pesan untuk catat transaksi.",
                ephemeral=True,
            )
            return

        # Minta link token dari web app
        async with httpx.AsyncClient(timeout=15) as http:
            res = await http.post(
                f"{APP_URL}/api/discord/link",
                json={
                    "discord_id": discord_id,
                    "discord_name": str(interaction.user),
                },
                headers={"Authorization": f"Bearer {BOT_API_SECRET}"},
            )

        if res.status_code == 409:
            await interaction.followup.send(
                "✅ Akun sudah terhubung!", ephemeral=True
            )
            return

        data = res.json()
        url = data.get("url", "")

        embed = discord.Embed(
            title="🔗 Hubungkan Akun Dompetku",
            description=(
                f"Klik link berikut untuk menghubungkan akun Discord ke Dompetku:\n\n"
                f"**[👉 Klik di sini untuk menghubungkan]({url})**\n\n"
                f"⏱️ Link berlaku **5 menit**.\n\n"
                f"Jika belum punya akun Dompetku, kamu bisa daftar langsung di halaman tersebut."
            ),
            color=0x34D399,
        )
        embed.set_footer(text="Dompetku • Kelola keuanganmu dengan lebih tenang")
        await interaction.followup.send(embed=embed, ephemeral=True)

    except Exception as e:
        await interaction.followup.send(
            f"⚠️ Gagal membuat link: {e}", ephemeral=True
        )


# ── /unlink — Putuskan koneksi Discord ───────────────────────────────────────
@tree.command(
    name="unlink", description="Putuskan koneksi Discord dari akun Dompetku Web"
)
async def unlink_command(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    discord_id = str(interaction.user.id)
    try:
        from database import get_supabase

        sb = get_supabase()
        result = (
            sb.table("discord_links").delete().eq("discord_id", discord_id).execute()
        )
        if result and getattr(result, "data", None) and len(result.data) > 0:
            await interaction.followup.send(
                "✅ Akun Discord sudah diputus dari Dompetku. Kamu bisa hubungkan lagi kapan saja dengan `/link`.",
                ephemeral=True,
            )
        else:
            await interaction.followup.send(
                "⚠️ Akun Discord kamu belum terhubung ke Dompetku. Gunakan `/link` untuk menghubungkan.",
                ephemeral=True,
            )
    except Exception as e:
        await interaction.followup.send(f"⚠️ Gagal memutus koneksi: {e}", ephemeral=True)


# ── /status — Cek status koneksi ─────────────────────────────────────────────
@tree.command(name="status", description="Cek status koneksi akun Discord ke Dompetku")
async def status_command(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    discord_id = str(interaction.user.id)
    try:
        user_id = get_user_id_from_discord(discord_id)
        if user_id:
            embed = discord.Embed(
                title="✅ Terhubung",
                description="Akun Discord kamu sudah terhubung ke Dompetku!\nLangsung kirim pesan untuk catat transaksi.",
                color=0x34D399,
            )
        else:
            embed = discord.Embed(
                title="❌ Belum Terhubung",
                description="Akun Discord kamu belum terhubung.\nGunakan `/link` untuk menghubungkan.",
                color=0xEF4444,
            )
        await interaction.followup.send(embed=embed, ephemeral=True)
    except Exception as e:
        await interaction.followup.send(f"⚠️ Terjadi kesalahan: {e}", ephemeral=True)


# ── /setchannel — Set channel untuk bot (admin only) ─────────────────────────
@tree.command(
    name="setchannel",
    description="Set channel ini sebagai channel Dompetku (Admin only)",
)
@app_commands.default_permissions(manage_guild=True)
async def setchannel_command(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)

    if not interaction.guild:
        await interaction.followup.send(
            "⚠️ Perintah ini hanya bisa dipakai di server, bukan DM.", ephemeral=True
        )
        return

    guild_id = str(interaction.guild.id)
    channel_id = str(interaction.channel_id)
    set_by = str(interaction.user.id)

    success = set_server_channel(guild_id, channel_id, set_by)
    if success:
        embed = discord.Embed(
            title="✅ Channel Dompetku Aktif!",
            description=(
                f"Bot Dompetku sekarang aktif di <#{channel_id}>.\n\n"
                f"Member bisa mulai catat transaksi di channel ini.\n"
                f"Pastikan mereka sudah `/link` akun terlebih dahulu."
            ),
            color=0x34D399,
        )
        embed.set_footer(text="Gunakan /removechannel untuk menonaktifkan")
        await interaction.followup.send(embed=embed, ephemeral=True)

        # Kirim notifikasi publik di channel
        public_embed = discord.Embed(
            title="🎉 Dompetku Aktif di Channel Ini!",
            description=(
                "Bot Dompetku sudah aktif di channel ini.\n\n"
                "**Cara mulai:**\n"
                "1️⃣ Ketik `/link` untuk hubungkan akun Discord ke Dompetku\n"
                "2️⃣ Langsung kirim pesan untuk catat transaksi!\n\n"
                "Contoh: *\"Beli kopi 25rb\"* atau *\"Gajian 5jt\"*"
            ),
            color=0x34D399,
        )
        await interaction.channel.send(embed=public_embed)
    else:
        await interaction.followup.send(
            "⚠️ Gagal mengatur channel. Coba lagi nanti.", ephemeral=True
        )


# ── /removechannel — Hapus channel setting (admin only) ──────────────────────
@tree.command(
    name="removechannel",
    description="Nonaktifkan bot Dompetku dari server ini (Admin only)",
)
@app_commands.default_permissions(manage_guild=True)
async def removechannel_command(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)

    if not interaction.guild:
        await interaction.followup.send(
            "⚠️ Perintah ini hanya bisa dipakai di server, bukan DM.", ephemeral=True
        )
        return

    guild_id = str(interaction.guild.id)
    success = remove_server_channel(guild_id)
    if success:
        embed = discord.Embed(
            title="👋 Dompetku Dinonaktifkan",
            description=(
                "Bot Dompetku sudah dinonaktifkan dari server ini.\n\n"
                "Gunakan `/setchannel` di channel manapun untuk mengaktifkan kembali."
            ),
            color=0xFBBF24,
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
    else:
        await interaction.followup.send(
            "⚠️ Gagal menghapus pengaturan. Coba lagi nanti.", ephemeral=True
        )


# ── on_message — Proses transaksi dari chat ──────────────────────────────────
@client.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    # ── Channel guard: hanya proses pesan di channel yang sudah di-set ────
    if message.guild:
        # Pesan di server → cek apakah channel sudah diatur
        allowed_channel = get_server_channel(str(message.guild.id))
        if not allowed_channel:
            # Server belum setup, abaikan semua pesan (slash commands tetap jalan)
            return
        if str(message.channel.id) != allowed_channel:
            # Pesan di channel lain, abaikan
            return
    # Jika DM (message.guild is None), langsung proses tanpa channel guard

    discord_id = str(message.author.id)
    user_id = get_user_id_from_discord(discord_id)

    if not user_id:
        embed = discord.Embed(
            title="👋 Halo!",
            description=(
                "Akun Discord kamu belum terhubung ke Dompetku.\n\n"
                "Gunakan perintah `/link` untuk menghubungkan, atau daftar dulu di web Dompetku."
            ),
            color=0xFBBF24,
        )
        await message.reply(embed=embed)
        return

    # Parse gambar jika ada
    image_data = None
    for attachment in message.attachments:
        content_type = attachment.content_type or ""
        if content_type.startswith("image/") or attachment.filename.lower().endswith(
            IMAGE_EXTENSIONS
        ):
            img_bytes = await attachment.read()
            b64_str = base64.b64encode(img_bytes).decode("utf-8")
            mime = (
                content_type if content_type.startswith("image/") else "image/jpeg"
            )
            image_data = {"mime_type": mime, "b64": b64_str}
            break  # Ambil gambar pertama

    # Abaikan jika pesan kosong dan tidak ada gambar
    if not message.content.strip() and not image_data:
        return

    async with message.channel.typing():
        try:
            # Jalankan LangGraph di thread terpisah agar event loop Discord tidak terblokir
            reply = await asyncio.to_thread(
                process_message, message.content, user_id, image_data
            )
            await message.reply(reply)
        except Exception as e:
            await message.reply(f"⚠️ Terjadi kesalahan saat memproses pesan: {e}")


if __name__ == "__main__":
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        raise ValueError("DISCORD_TOKEN belum diatur di environment variables / .env!")
    client.run(token)