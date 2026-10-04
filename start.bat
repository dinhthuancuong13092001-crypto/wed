@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Vui lòng cài Node.js 22 hoặc 24 LTS rồi chạy lại.
 pause
 exit /b 1
)
if not exist node_modules\next (
 call npm.cmd install
 if errorlevel 1 goto failed
)
call npm.cmd run db:migrate
if errorlevel 1 goto failed
if not exist .next\BUILD_ID (
 call npm.cmd run build
 if errorlevel 1 goto failed
)
call npm.cmd run start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Khởi động thất bại. Xem thông báo lỗi phía trên.
pause
exit /b 1
