export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      anexos_registro: {
        Row: {
          caminho_storage: string
          criado_em: string | null
          descricao: string | null
          enviado_por_id: number | null
          hash_sha256: string | null
          id: number
          nome_arquivo_original: string
          registro_mestre_id: number | null
          tamanho_bytes: number | null
          tipo_mime: string | null
        }
        Insert: {
          caminho_storage: string
          criado_em?: string | null
          descricao?: string | null
          enviado_por_id?: number | null
          hash_sha256?: string | null
          id?: number
          nome_arquivo_original: string
          registro_mestre_id?: number | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
        }
        Update: {
          caminho_storage?: string
          criado_em?: string | null
          descricao?: string | null
          enviado_por_id?: number | null
          hash_sha256?: string | null
          id?: number
          nome_arquivo_original?: string
          registro_mestre_id?: number | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anexos_registro_enviado_por_id_fkey"
            columns: ["enviado_por_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_registro_registro_mestre_id_fkey"
            columns: ["registro_mestre_id"]
            isOneToOne: false
            referencedRelation: "registros_mestre"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogos_dominio: {
        Row: {
          ativo: boolean | null
          criado_por: number | null
          descricao: string | null
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          criado_por?: number | null
          descricao?: string | null
          id?: number
          nome: string
        }
        Update: {
          ativo?: boolean | null
          criado_por?: number | null
          descricao?: string | null
          id?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogos_dominio_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_modulo: {
        Row: {
          icone_referencia: string | null
          id: number
          nome: string
        }
        Insert: {
          icone_referencia?: string | null
          id?: number
          nome: string
        }
        Update: {
          icone_referencia?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      definicao_colunas: {
        Row: {
          catalogo_referencia_id: number | null
          id: number
          label_visual: string
          mascara_formato: string | null
          modulo_id: number | null
          modulo_referencia_id: number | null
          nome_tecnico: string
          obrigatorio: boolean | null
          ordem: number | null
          sensivel_lgpd: boolean | null
          tipo: Database["public"]["Enums"]["tipo_coluna_enum"]
          unico: boolean | null
        }
        Insert: {
          catalogo_referencia_id?: number | null
          id?: number
          label_visual: string
          mascara_formato?: string | null
          modulo_id?: number | null
          modulo_referencia_id?: number | null
          nome_tecnico: string
          obrigatorio?: boolean | null
          ordem?: number | null
          sensivel_lgpd?: boolean | null
          tipo: Database["public"]["Enums"]["tipo_coluna_enum"]
          unico?: boolean | null
        }
        Update: {
          catalogo_referencia_id?: number | null
          id?: number
          label_visual?: string
          mascara_formato?: string | null
          modulo_id?: number | null
          modulo_referencia_id?: number | null
          nome_tecnico?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          sensivel_lgpd?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_coluna_enum"]
          unico?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "definicao_colunas_catalogo_referencia_id_fkey"
            columns: ["catalogo_referencia_id"]
            isOneToOne: false
            referencedRelation: "catalogos_dominio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "definicao_colunas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "definicao_colunas_modulo_referencia_id_fkey"
            columns: ["modulo_referencia_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean | null
          codigo_administrativo: string | null
          departamento_pai_id: number | null
          id: number
          nome: string
          sigla: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo_administrativo?: string | null
          departamento_pai_id?: number | null
          id?: number
          nome: string
          sigla?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo_administrativo?: string | null
          departamento_pai_id?: number | null
          id?: number
          nome?: string
          sigla?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_departamento_pai_id_fkey"
            columns: ["departamento_pai_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_aprovacao: {
        Row: {
          data_registro: string | null
          id: number
          mensagem: string
          registro_mestre_id: number | null
          tipo: string | null
          usuario_id: number | null
        }
        Insert: {
          data_registro?: string | null
          id?: number
          mensagem: string
          registro_mestre_id?: number | null
          tipo?: string | null
          usuario_id?: number | null
        }
        Update: {
          data_registro?: string | null
          id?: number
          mensagem?: string
          registro_mestre_id?: number | null
          tipo?: string | null
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_aprovacao_registro_mestre_id_fkey"
            columns: ["registro_mestre_id"]
            isOneToOne: false
            referencedRelation: "registros_mestre"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_aprovacao_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_catalogo: {
        Row: {
          ativo: boolean | null
          catalogo_id: number | null
          chave: string
          id: number
          valor_exibicao: string
        }
        Insert: {
          ativo?: boolean | null
          catalogo_id?: number | null
          chave: string
          id?: number
          valor_exibicao: string
        }
        Update: {
          ativo?: boolean | null
          catalogo_id?: number | null
          chave?: string
          id?: number
          valor_exibicao?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_catalogo_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogos_dominio"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_sistema: {
        Row: {
          acao: Database["public"]["Enums"]["acao_auditoria_enum"]
          dados_anteriores: Json | null
          dados_novos: Json | null
          data_hora: string | null
          detalhes_tecnicos: string | null
          id: number
          id_alvo: number | null
          ip: string | null
          tabela_alvo: string | null
          usuario_id: number | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["acao_auditoria_enum"]
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          data_hora?: string | null
          detalhes_tecnicos?: string | null
          id?: number
          id_alvo?: number | null
          ip?: string | null
          tabela_alvo?: string | null
          usuario_id?: number | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["acao_auditoria_enum"]
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          data_hora?: string | null
          detalhes_tecnicos?: string | null
          id?: number
          id_alvo?: number | null
          ip?: string | null
          tabela_alvo?: string | null
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_sistema_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_importacao: {
        Row: {
          arquivo_original: string | null
          data_fim: string | null
          data_inicio: string | null
          id: number
          log_erros: Json | null
          modulo_id: number | null
          status: string | null
          usuario_id: number | null
        }
        Insert: {
          arquivo_original?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: number
          log_erros?: Json | null
          modulo_id?: number | null
          status?: string | null
          usuario_id?: number | null
        }
        Update: {
          arquivo_original?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: number
          log_erros?: Json | null
          modulo_id?: number | null
          status?: string | null
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_importacao_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          ativo: boolean | null
          categoria_id: number | null
          criado_em: string | null
          descricao: string | null
          exige_aprovacao: boolean | null
          id: number
          nome: string
          permite_anexos: boolean | null
          responsavel_criacao_id: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: number | null
          criado_em?: string | null
          descricao?: string | null
          exige_aprovacao?: boolean | null
          id?: number
          nome: string
          permite_anexos?: boolean | null
          responsavel_criacao_id?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: number | null
          criado_em?: string | null
          descricao?: string | null
          exige_aprovacao?: boolean | null
          id?: number
          nome?: string
          permite_anexos?: boolean | null
          responsavel_criacao_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modulos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_modulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modulos_responsavel_criacao_id_fkey"
            columns: ["responsavel_criacao_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criada_em: string | null
          id: number
          lida: boolean | null
          link_acao: string | null
          mensagem: string | null
          prioridade: Database["public"]["Enums"]["prioridade_notificacao_enum"] | null
          titulo: string | null
          usuario_destino_id: number | null
        }
        Insert: {
          criada_em?: string | null
          id?: number
          lida?: boolean | null
          link_acao?: string | null
          mensagem?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_notificacao_enum"] | null
          titulo?: string | null
          usuario_destino_id?: number | null
        }
        Update: {
          criada_em?: string | null
          id?: number
          lida?: boolean | null
          link_acao?: string | null
          mensagem?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_notificacao_enum"] | null
          titulo?: string | null
          usuario_destino_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_destino_id_fkey"
            columns: ["usuario_destino_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          descricao: string | null
          id: number
          nivel_acesso: number | null
          nome: string
        }
        Insert: {
          descricao?: string | null
          id?: number
          nivel_acesso?: number | null
          nome: string
        }
        Update: {
          descricao?: string | null
          id?: number
          nivel_acesso?: number | null
          nome?: string
        }
        Relationships: []
      }
      permissoes_modulo: {
        Row: {
          modulo_id: number
          pode_aprovar: boolean | null
          pode_editar: boolean | null
          pode_exportar: boolean | null
          pode_inserir: boolean | null
          pode_visualizar: boolean | null
          usuario_id: number
        }
        Insert: {
          modulo_id: number
          pode_aprovar?: boolean | null
          pode_editar?: boolean | null
          pode_exportar?: boolean | null
          pode_inserir?: boolean | null
          pode_visualizar?: boolean | null
          usuario_id: number
        }
        Update: {
          modulo_id?: number
          pode_aprovar?: boolean | null
          pode_editar?: boolean | null
          pode_exportar?: boolean | null
          pode_inserir?: boolean | null
          pode_visualizar?: boolean | null
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_modulo_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissoes_modulo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_mestre: {
        Row: {
          criado_em: string | null
          id: number
          modulo_id: number | null
          uuid_externo: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: number
          modulo_id?: number | null
          uuid_externo?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: number
          modulo_id?: number | null
          uuid_externo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_mestre_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          cpf: string
          criado_em: string | null
          departamento_id: number
          email: string
          id: number
          is_ativo: boolean | null
          nome_completo: string
          perfil_id: number
          senha_hash: string
          ultimo_login: string | null
        }
        Insert: {
          cpf: string
          criado_em?: string | null
          departamento_id: number
          email: string
          id?: number
          is_ativo?: boolean | null
          nome_completo: string
          perfil_id: number
          senha_hash: string
          ultimo_login?: string | null
        }
        Update: {
          cpf?: string
          criado_em?: string | null
          departamento_id?: number
          email?: string
          id?: number
          is_ativo?: boolean | null
          nome_completo?: string
          perfil_id?: number
          senha_hash?: string
          ultimo_login?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      versoes_registro: {
        Row: {
          avaliado_por_id: number | null
          conteudo: Json
          criado_em: string | null
          criado_por_id: number | null
          data_avaliacao: string | null
          id: number
          ip_origem: string | null
          is_atual: boolean | null
          registro_mestre_id: number | null
          status: Database["public"]["Enums"]["status_aprovacao_enum"] | null
          versao: number
        }
        Insert: {
          avaliado_por_id?: number | null
          conteudo: Json
          criado_em?: string | null
          criado_por_id?: number | null
          data_avaliacao?: string | null
          id?: number
          ip_origem?: string | null
          is_atual?: boolean | null
          registro_mestre_id?: number | null
          status?: Database["public"]["Enums"]["status_aprovacao_enum"] | null
          versao: number
        }
        Update: {
          avaliado_por_id?: number | null
          conteudo?: Json
          criado_em?: string | null
          criado_por_id?: number | null
          data_avaliacao?: string | null
          id?: number
          ip_origem?: string | null
          is_atual?: boolean | null
          registro_mestre_id?: number | null
          status?: Database["public"]["Enums"]["status_aprovacao_enum"] | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "versoes_registro_avaliado_por_id_fkey"
            columns: ["avaliado_por_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versoes_registro_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versoes_registro_registro_mestre_id_fkey"
            columns: ["registro_mestre_id"]
            isOneToOne: false
            referencedRelation: "registros_mestre"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      acao_auditoria_enum:
        | "LOGIN"
        | "LOGOUT"
        | "CRIACAO"
        | "EDICAO"
        | "EXCLUSAO"
        | "APROVACAO"
        | "REJEICAO"
        | "EXPORTACAO"
        | "IMPORTACAO"
        | "LIMPEZA_COLUNA"
        | "UPLOAD_ANEXO"
        | "EXCLUSAO_ANEXO"
        | "TENTATIVA_VIOLACAO_LOG"
      prioridade_notificacao_enum: "BAIXA" | "NORMAL" | "ALTA" | "CRITICA"
      status_aprovacao_enum:
        | "RASCUNHO"
        | "PENDENTE"
        | "OFICIAL"
        | "REJEITADO"
        | "OBSOLETO"
      tipo_coluna_enum:
        | "TEXTO"
        | "TEXTO_LONGO"
        | "INTEIRO"
        | "DECIMAL"
        | "DATA"
        | "HORA"
        | "BOOLEANO"
        | "CPF"
        | "CNPJ"
        | "SELECAO_LISTA"
        | "REFERENCIA_MODULO"
        | "REFERENCIA_CATALOGO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acao_auditoria_enum: {
        LOGIN: "LOGIN",
        LOGOUT: "LOGOUT",
        CRIACAO: "CRIACAO",
        EDICAO: "EDICAO",
        EXCLUSAO: "EXCLUSAO",
        APROVACAO: "APROVACAO",
        REJEICAO: "REJEICAO",
        EXPORTACAO: "EXPORTACAO",
        IMPORTACAO: "IMPORTACAO",
        LIMPEZA_COLUNA: "LIMPEZA_COLUNA",
        UPLOAD_ANEXO: "UPLOAD_ANEXO",
        EXCLUSAO_ANEXO: "EXCLUSAO_ANEXO",
        TENTATIVA_VIOLACAO_LOG: "TENTATIVA_VIOLACAO_LOG",
      },
      prioridade_notificacao_enum: {
        BAIXA: "BAIXA",
        NORMAL: "NORMAL",
        ALTA: "ALTA",
        CRITICA: "CRITICA",
      },
      status_aprovacao_enum: {
        RASCUNHO: "RASCUNHO",
        PENDENTE: "PENDENTE",
        OFICIAL: "OFICIAL",
        REJEITADO: "REJEITADO",
        OBSOLETO: "OBSOLETO",
      },
      tipo_coluna_enum: {
        TEXTO: "TEXTO",
        TEXTO_LONGO: "TEXTO_LONGO",
        INTEIRO: "INTEIRO",
        DECIMAL: "DECIMAL",
        DATA: "DATA",
        HORA: "HORA",
        BOOLEANO: "BOOLEANO",
        CPF: "CPF",
        CNPJ: "CNPJ",
        SELECAO_LISTA: "SELECAO_LISTA",
        REFERENCIA_MODULO: "REFERENCIA_MODULO",
        REFERENCIA_CATALOGO: "REFERENCIA_CATALOGO",
      },
    },
  },
} as const