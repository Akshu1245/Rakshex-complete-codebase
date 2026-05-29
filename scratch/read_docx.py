import sys
import zipfile
import xml.etree.ElementTree as ET
import os

def read_docx(file_path):
    try:
        with zipfile.ZipFile(file_path) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            paragraphs = []
            for p in root.findall('.//w:p', namespaces):
                texts = []
                for t in p.findall('.//w:t', namespaces):
                    if t.text:
                        texts.append(t.text)
                paragraphs.append(''.join(texts))
            return '\n'.join(paragraphs)
    except Exception as e:
        return f"Error reading {file_path}: {e}"

if __name__ == "__main__":
    folder = r"C:\Users\aksha\Downloads\new ui"
    files = [
        "RakshEx__Final_Figma_AI_Brief.docx",
        "RakshEx__Next-Level_UI_Design_Brief.docx",
        "RakshEx__Revised_Design_Brief_v2.docx",
        "RakshEx__ULTIMATE_Design_Brief_v3.docx"
    ]
    out_path = os.path.join("scratch", "design_briefs.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        for filename in files:
            path = os.path.join(folder, filename)
            f.write(f"\n========================================\nFILE: {filename}\n========================================\n")
            text = read_docx(path)
            f.write(text)
            f.write("\n")
    print(f"Successfully wrote all content to {out_path}")
