#!/data/data/com.termux/files/usr/bin/bash
# Instalação do CONBYBITE 2.0 no Termux — HELLO FRIEND, BY SLOVACK
set -e
pkg update -y
pkg install -y nodejs-lts termux-api curl
mkdir -p "$HOME/conbybite"
BASE="${CONBYBITE_URL:-https://conbybite-2.netlify.app}"
curl -fsSL "$BASE/termux/conbybite.mjs" -o "$HOME/conbybite/conbybite.mjs"
cat > "$PREFIX/bin/conbybite" <<SH
#!/data/data/com.termux/files/usr/bin/bash
exec node "\$HOME/conbybite/conbybite.mjs" "\$@"
SH
chmod +x "$PREFIX/bin/conbybite"
echo ""
echo "Pronto! Instale também o app Termux:API (F-Droid) para voz."
echo "Use:  conbybite            (texto)"
echo "      conbybite --voz      (respostas faladas)"
echo "      conbybite --maos-livres"
echo "      conbybite --teste"
