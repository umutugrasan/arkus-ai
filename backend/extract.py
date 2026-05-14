from pypdf import PdfReader

def read_pdf(file_path):
    try:
        reader = PdfReader(file_path)
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
        return text
    except Exception as e:
        return f'Error: {e}'

print('--- Basiret_AI_Proje_Plani_Final.pdf ---')
print(read_pdf('c:/Users/yunusozdemir/Desktop/hackhathlon/Basiret_AI_Proje_Plani_Final.pdf')[:2500])
print('--- BTK HACKATHON 26 ÖZET.pdf ---')
print(read_pdf('c:/Users/yunusozdemir/Desktop/hackhathlon/BTK HACKATHON 26 ÖZET.pdf')[:2500])
