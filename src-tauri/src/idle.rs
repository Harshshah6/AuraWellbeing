#[cfg(target_os = "windows")]
pub fn get_idle_time_ms() -> u64 {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use std::mem;

    // Direct system tick check
    extern "system" {
        fn GetTickCount64() -> u64;
    }

    let mut lii: LASTINPUTINFO = unsafe { mem::zeroed() };
    lii.cbSize = mem::size_of::<LASTINPUTINFO>() as u32;

    unsafe {
        if GetLastInputInfo(&mut lii) != 0 {
            let now = GetTickCount64();
            let last_input_tick = lii.dwTime as u64;
            // Handle wrap-around or tick discrepancies
            if now >= last_input_tick {
                now - last_input_tick
            } else {
                0
            }
        } else {
            0
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_idle_time_ms() -> u64 {
    0
}

pub fn is_user_idle(idle_threshold_seconds: u64) -> bool {
    let idle_ms = get_idle_time_ms();
    (idle_ms / 1000) >= idle_threshold_seconds
}
