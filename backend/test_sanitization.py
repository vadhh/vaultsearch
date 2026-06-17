import os

def test_sanitization():
    # Simulate the filename sanitization logic from main.py
    unsafe_filenames = [
        "../../etc/passwd",
        "some/path/to/document.pdf",
        "..\\..\\windows\\win.ini",
        "normal_document.pdf"
    ]
    
    expected_safe = [
        "passwd",
        "document.pdf",
        "win.ini",
        "normal_document.pdf"
    ]
    
    for unsafe, expected in zip(unsafe_filenames, expected_safe):
        # The sanitization logic used in backend/main.py:
        sanitized = os.path.basename(unsafe.replace('\\', '/'))
        
        print(f"Sanitizing '{unsafe}' -> '{sanitized}' (Expected: '{expected}')")
        assert sanitized == expected, f"Sanitization failed! Got: {sanitized}"

if __name__ == "__main__":
    test_sanitization()
    print("✅ All sanitization checks passed successfully!")
