local ffi = require('ffi')
local version_url = "https://sourceforge.net/projects/libportable/files/Iceweasel/update_info.txt/download"

local CURLOPT_WRITEDATA = 10001
local CURLOPT_URL = 10002
local CURLOPT_WRITEFUNCTION = 20011
local CURLOPT_LOW_SPEED_LIMIT = 19
local CURLOPT_LOW_SPEED_TIME = 20
local CURLOPT_FOLLOWLOCATION = 52
local CURLOPT_MAXREDIRS = 68
local CURLOPT_CONNECTTIMEOUT = 78

ffi.cdef[[

typedef struct
{
    int cur;
    char *str;
} ini_buffer;

typedef size_t (*curl_write_callback)(char *buffer, size_t size, size_t nitems, void *outstream);
int MessageBoxW(void *w, const wchar_t *txt, const wchar_t *cap, uint32_t type);
void *memcpy(void *str1, const void *str2, size_t n);
void *realloc(void *memblock, size_t size);
void free(void *);

]]

-- 获取浏览器主窗口句柄
local function get_handle()
    return tonumber(getenv_lua("UPCHECK_MOZ_HWND"))
end

-- UTF-8 to UTF-16
local function utf16(input)
    local wstr = ffi.cast("void *", utf8_utf16_lua(input))
    ffi.gc(wstr,(function(self)
        if wstr ~= nil then ffi.C.free(wstr) end
        print("call gc, goodbye!")
    end))
    return wstr
end

-- 获取远程版本
local function get_remote_version()
    local res = -1
    local curl = luacurl_easy_init()
    local xbuf = ffi.new("ini_buffer", {0, nil})
    if (curl ~= nil) then
        -- LUA函数转换成c回调函数
        local version_func = ffi.cast("curl_write_callback", function(ptr, size, nmemb, userdata)
            local written = (size * nmemb);
            local pbuf = ffi.cast("ini_buffer *", userdata)
            pbuf.str = ffi.C.realloc(pbuf.str, pbuf.cur + written)
            ffi.C.memcpy(pbuf.str + pbuf.cur, ptr, written)
            pbuf.cur = pbuf.cur + written
            return written
        end)
        luacurl_easy_setopt(curl, CURLOPT_URL, version_url)
        -- 回调函数必须做如下转换
        luacurl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, tonumber(ffi.cast("intptr_t", version_func)))
        -- cdata 值
        luacurl_easy_setopt(curl, CURLOPT_WRITEDATA, xbuf)
        luacurl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10);
        luacurl_easy_setopt(curl, CURLOPT_MAXREDIRS, 3);
        luacurl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1);
        res = luacurl_easy_perform(curl)
        if res ~= 0 then
            print(ffi.string(luacurl_easy_strerror(res)))
        end
        luacurl_easy_cleanup(curl)
        version_func:free()
    end
    if (res == 0) then
        res = luaini_cdata_parser(xbuf)
    end
    if (xbuf.str ~= nil) then
        ffi.C.free(xbuf.str)
    end
    return res
end

-- run入口函数, 接受四个参数
function run(title, err, latest, updated)
    local hwnd = get_handle()
    if (hwnd ~= nil) then
        local res = get_remote_version()
        if (res == 0) then
            ffi.C.MessageBoxW(ffi.cast("void *", hwnd), utf16(updated), utf16(title), 0)
        elseif (res == 1) then
            ffi.C.MessageBoxW(ffi.cast("void *", hwnd), utf16(latest), utf16(title), 0)
        else
            ffi.C.MessageBoxW(ffi.cast("void *", hwnd), utf16(err), utf16(title), 0)
        end
    end
    return 0
end