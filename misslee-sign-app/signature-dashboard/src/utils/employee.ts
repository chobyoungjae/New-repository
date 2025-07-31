export const generateEmployeeNumber = (lastNumber?: string): string => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  if (!lastNumber) {
    return `EMP${currentYear}0001`;
  }
  
  // EMP240001에서 숫자 부분 추출
  const numberPart = lastNumber.replace('EMP', '');
  const nextNumber = parseInt(numberPart) + 1;
  
  // 6자리 숫자로 포맷팅
  return `EMP${nextNumber.toString().padStart(6, '0')}`;
};

export const validateEmployeeNumber = (empNumber: string): boolean => {
  const regex = /^EMP\d{6}$/;
  return regex.test(empNumber);
};

export const extractYearFromEmployeeNumber = (empNumber: string): string => {
  if (!validateEmployeeNumber(empNumber)) return '';
  return empNumber.slice(3, 5);
};