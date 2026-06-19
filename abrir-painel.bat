@echo off
REM ============================================================
REM  Painel de Tracking DHL - inicializador local
REM  Sobe um servidor local SEM cache na pasta e abre o painel.
REM  Use SEMPRE este atalho (nao abra o index.html por duplo clique:
REM  file:// bloqueia o fetch dos CSVs do Google).
REM ============================================================
cd /d "%~dp0"
set PORT=8000

echo.
echo  Iniciando o Painel de Tracking DHL em http://localhost:%PORT%
echo  (deixe esta janela aberta enquanto usa o painel)
echo.

REM --- Python (py launcher) com servidor sem cache ---
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/index.html"
  py "%~dp0server.py"
  goto :eof
)

REM --- python ---
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/index.html"
  python "%~dp0server.py"
  goto :eof
)

REM --- Node (http-server com cache desativado: -c-1) ---
where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/index.html"
  npx --yes http-server "%~dp0" -p %PORT% -c-1
  goto :eof
)

echo  Nao encontrei Python nem Node instalados nesta maquina.
echo.
echo  Instale o Python em https://www.python.org/downloads/
echo  (marque "Add python.exe to PATH" na instalacao) e rode este
echo  arquivo de novo.
echo.
pause
