with open("src/components/Payroll.tsx", "r") as f:
    content = f.read()

if "getEmployeeAdvances" not in content.split("from '../services/storageService'")[0]:
    content = content.replace("import { getEmployees, saveEmployee", "import { getEmployees, saveEmployee, getEmployeeAdvances")

with open("src/components/Payroll.tsx", "w") as f:
    f.write(content)
