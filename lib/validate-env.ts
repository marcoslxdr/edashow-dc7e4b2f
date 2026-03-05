/**
 * Valida e garante que todas as variáveis de ambiente críticas estejam configuradas
 */

interface EnvironmentConfig {
  DATABASE_URL: string
  NEXTAUTH_SECRET: string
  NEXT_PUBLIC_SERVER_URL: string
  BLOB_READ_WRITE_TOKEN: string
}

interface ValidationResult {
  isValid: boolean
  missingVars: string[]
  invalidVars: { name: string; reason: string }[]
}

const REQUIRED_ENV_VARS: (keyof EnvironmentConfig)[] = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_SERVER_URL',
  'BLOB_READ_WRITE_TOKEN',
]

function validateEnvVar(name: keyof EnvironmentConfig, value: string | undefined): { valid: boolean; reason?: string } {
  if (!value || value.trim() === '') {
    return { valid: false, reason: 'Variável não definida ou vazia' }
  }

  switch (name) {
    case 'NEXTAUTH_SECRET':
      if (value.length < 32) {
        return { valid: false, reason: 'NEXTAUTH_SECRET deve ter pelo menos 32 caracteres' }
      }
      break

    case 'DATABASE_URL':
      if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
        return { valid: false, reason: 'DATABASE_URL deve começar com postgresql:// ou postgres://' }
      }
      break

    case 'NEXT_PUBLIC_SERVER_URL':
      try {
        new URL(value)
      } catch {
        return { valid: false, reason: 'NEXT_PUBLIC_SERVER_URL deve ser uma URL válida' }
      }
      break
  }

  return { valid: true }
}

export function validateEnvironment(): ValidationResult {
  const missingVars: string[] = []
  const invalidVars: { name: string; reason: string }[] = []

  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName]
    const validation = validateEnvVar(varName, value)

    if (!validation.valid) {
      if (!value || value.trim() === '') {
        missingVars.push(varName)
      } else {
        invalidVars.push({ name: varName, reason: validation.reason || 'Inválida' })
      }
    }
  }

  return {
    isValid: missingVars.length === 0 && invalidVars.length === 0,
    missingVars,
    invalidVars,
  }
}

export function displayValidationErrors(result: ValidationResult): void {
  console.error('\n' + '='.repeat(80))
  console.error('❌ ERRO: Variáveis de ambiente não configuradas corretamente')
  console.error('='.repeat(80))

  if (result.missingVars.length > 0) {
    console.error('\n📋 Variáveis ausentes:')
    result.missingVars.forEach((varName) => {
      console.error(`   ❌ ${varName}`)
    })
  }

  if (result.invalidVars.length > 0) {
    console.error('\n⚠️  Variáveis inválidas:')
    result.invalidVars.forEach(({ name, reason }) => {
      console.error(`   ❌ ${name}: ${reason}`)
    })
  }

  console.error('\n💡 Para corrigir:')
  console.error('   1. Copie o arquivo .env.example para .env')
  console.error('   2. Preencha todas as variáveis necessárias')
  console.error('   3. Reinicie o servidor de desenvolvimento')
  console.error('\n' + '='.repeat(80) + '\n')
}

export function ensureEnvironment(): boolean {
  const result = validateEnvironment()

  if (!result.isValid) {
    displayValidationErrors(result)
    return false
  }

  return true
}

export function getEnvVar(name: keyof EnvironmentConfig, defaultValue?: string): string {
  const value = process.env[name]

  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Variável de ambiente ${name} não está definida`)
  }

  return value
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
  NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || '',
} as const
