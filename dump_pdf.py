from pypdf import PdfReader

reader = PdfReader(r"d:\syllabus\fixtures\legacy\MCA-syllabus-2022-24-29.pdf")
with open(r"d:\syllabus\fixtures\legacy\extracted_full.txt", "w", encoding="utf-8") as f:
    f.write(f"Total pages: {len(reader.pages)}\n")
    for i, page in enumerate(reader.pages):
        f.write(f"\n==================== PAGE {i+1} ====================\n")
        f.write(page.extract_text() or "")
print("Dumped successfully")
