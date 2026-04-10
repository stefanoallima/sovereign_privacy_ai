from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("helvetica", size=16)
pdf.cell(200, 10, txt="Fake PII Data Example", ln=1, align='C')
pdf.ln(10)

pdf.set_font("helvetica", size=12)
data = [
    ["Name", "Surname", "BSN", "SSN"],
    ["John", "Doe", "000123456", "000-12-3456"],
    ["Jane", "Smith", "999876543", "666-99-8888"],
    ["Alice", "Johnson", "123000456", "900-00-0000"],
    ["Bob", "Williams", "456789000", "000-00-0000"],
    ["Charlie", "Brown", "000000000", "123-00-6789"],
    ["Eva", "Green", "111222333", "000-55-4444"],
    ["Michael", "White", "444555666", "666-11-2222"],
]

# Set column widths
col_widths = [40, 40, 50, 50]
line_height = pdf.font_size * 2.5

# Table Header
pdf.set_font("helvetica", style="B", size=12)
for i in range(len(data[0])):
    pdf.cell(col_widths[i], line_height, data[0][i], border=1)
pdf.ln(line_height)

# Table Rows
pdf.set_font("helvetica", size=12)
for row in data[1:]:
    for i in range(len(row)):
        pdf.cell(col_widths[i], line_height, row[i], border=1)
    pdf.ln(line_height)

pdf.output("fake_pii_data.pdf")
print("PDF created successfully at fake_pii_data.pdf")
