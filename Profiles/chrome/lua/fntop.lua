--[=[

upcheck 调用lua脚本示例, 浏览器窗口置顶.
upcheck 导出如下五个环境变量, 可以在脚本里直接获取
UPCHECK_MOZ_HWND    // 浏览器主窗口句柄
UPCHECK_MOZ_PID     // 浏览器主进程pid
UPCHECK_MOZ_BIN     // 浏览器进程所在目录
UPCHECK_MOZ_CHROME  // chrome脚本所在目录
UPCHECK_MOZ_PROFD   // 用户配置文件所在目录
在lua脚本中获取环境变量使用 getenv_lua
在lua脚本中写入环境变量使用 putenv_lua
下面代码演示了用法

]=]

local GWL_EXSTYLE = -20
local SWP_NOSIZE = 0x0001
local SWP_NOMOVE = 0x0002
local SWP_FRAMECHANGED = 0x0020
local WS_EX_TOPMOST = 0x00000008

local bit = require("bit")
local ffi = require('ffi')

ffi.cdef[[

void SetWindowPos(void*, void*, int, int, int, int, uint32_t);
intptr_t GetWindowLongPtrW(void *hwnd, int index);

]]

local function get_handle()
    return tonumber(getenv_lua("UPCHECK_MOZ_HWND"))
end

local function get_top(hwnd)
    local exstyle = ffi.C.GetWindowLongPtrW(ffi.cast("void *", hwnd), GWL_EXSTYLE)
    local flags = bit.band(exstyle, WS_EX_TOPMOST)
    return (flags ~= 0)
end

-- run入口函数, 最多可接受64个参数
function run()
  local hwnd = get_handle()
  if (hwnd ~= nil) then
    if (get_top(hwnd) == false) then
      ffi.C.SetWindowPos(ffi.cast("void *", hwnd), ffi.cast("void *", -1), 0, 0, 0, 0, bit.bor(SWP_NOMOVE, SWP_NOSIZE, SWP_FRAMECHANGED))
    else
      ffi.C.SetWindowPos(ffi.cast("void *", hwnd), ffi.cast("void *", -2), 0, 0, 0, 0, bit.bor(SWP_NOMOVE, SWP_NOSIZE, SWP_FRAMECHANGED))
    end
  end
end
