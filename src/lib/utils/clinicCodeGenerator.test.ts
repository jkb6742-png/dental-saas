/**
 * Test file for clinic code generator utility functions
 * Run with: npm test -- clinicCodeGenerator.test.ts
 */

import { generateCodeFromName, isValidClinicCode } from './clinicCodeGenerator'

describe('Clinic Code Generator', () => {
  describe('generateCodeFromName', () => {
    test('should generate code from Korean clinic name', () => {
      expect(generateCodeFromName('이생각치과')).toBe('이생각')
      expect(generateCodeFromName('서울치과')).toBe('서울')
      expect(generateCodeFromName('강남연세치과')).toBe('강남연세')
    })

    test('should generate code from English clinic name', () => {
      expect(generateCodeFromName('Seoul Dental Clinic')).toBe('seouldentalclinic')
      expect(generateCodeFromName('Happy Dental')).toBe('happydental')
    })

    test('should handle mixed Korean and English', () => {
      expect(generateCodeFromName('Seoul 연세치과')).toBe('seoul연세')
      expect(generateCodeFromName('강남 Dental 치과')).toBe('강남dental')
    })

    test('should remove special characters', () => {
      expect(generateCodeFromName('이생각-치과!')).toBe('이생각')
      expect(generateCodeFromName('Seoul & Dental@')).toBe('seouldental')
    })

    test('should handle numbers', () => {
      expect(generateCodeFromName('제1치과')).toBe('제1')
      expect(generateCodeFromName('Dental 365')).toBe('dental365')
    })

    test('should limit length to 20 characters', () => {
      const longName = '매우긴이름의치과병원입니다치과'
      expect(generateCodeFromName(longName)).toBe('매우긴이름의치과병원입니다치과'.substring(0, 20))
    })

    test('should handle empty or short names', () => {
      expect(generateCodeFromName('')).toBe('')
      expect(generateCodeFromName('A')).toBe('a')
      expect(generateCodeFromName('치과')).toBe('')
    })
  })

  describe('isValidClinicCode', () => {
    test('should accept valid codes', () => {
      expect(isValidClinicCode('이생각')).toBe(true)
      expect(isValidClinicCode('seoul-dental')).toBe(true)
      expect(isValidClinicCode('clinic123')).toBe(true)
      expect(isValidClinicCode('강남연세')).toBe(true)
    })

    test('should reject invalid codes', () => {
      expect(isValidClinicCode('a')).toBe(false) // too short
      expect(isValidClinicCode('')).toBe(false) // empty
      expect(isValidClinicCode('clinic@')).toBe(false) // special characters
      expect(isValidClinicCode('clinic!')).toBe(false) // special characters
      expect(isValidClinicCode('clinic space')).toBe(false) // spaces
    })

    test('should reject codes that are too long', () => {
      const longCode = 'a'.repeat(51)
      expect(isValidClinicCode(longCode)).toBe(false)
    })
  })
})