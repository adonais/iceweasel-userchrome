local ffi = require('ffi')

ffi.cdef[[
    
int MessageBoxW(void *w, const wchar_t *txt, const wchar_t *cap, uint32_t type);

]]

-- 获取浏览器主窗口句柄
local function get_handle()
    return tonumber(getenv_lua("UPCHECK_MOZ_HWND"))
end

-- UTF-8 to UTF-16
local function utf16(input)
    return utf8_utf16_lua(input)
end

-- filetime_lua, capi, 返回一个int64_t的字符串形式
local function get_file_time()
    local res = nil
    local path = getenv_lua("UPCHECK_MOZ_PROFD")
    if (path ~= nil) then
        res = filetime_lua(path .. "\\" .. "parent.lock")
    end
    return res
end

-- curtime_lua, capi, 返回当前秒的字符串
-- difftime_lua, capi, 计算2个int64_t格式的差值
-- fmttime_lua, capi, 通过diff值, 格式化str字符串
local function get_format_str(str)
    local fmt = nil
    local diff = nil
    local cur = curtime_lua()
    local ft = get_file_time()
    if (cur ~= nil and ft ~= nil) then
        diff = difftime_lua(cur, ft)
    end
    if (diff ~= nil) then
        fmt = fmttime_lua(str, diff)
    end
    return fmt
end

-- run入口函数, 接受二个参数
function run(content, title)
  local hwnd = get_handle()
  if (hwnd ~= nil) then
    local fmt = get_format_str(content)
    if (fmt ~= nil) then
        local l10n = utf16(fmt)
        local info = utf16(title)
        ffi.C.MessageBoxW(ffi.cast("void *", hwnd), l10n, info, 0)
        -- 使用capi释放内存
        free_lua(l10n)
        free_lua(info)
    end
  end
end