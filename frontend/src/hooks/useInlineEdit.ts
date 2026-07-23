import { useReducer } from 'react'

export interface InlineEditForm {
  data_referencia: string
  data_pagamento: string
  valor_pago: string
  observacao: string
}

type EditState =
  | { mode: 'idle' }
  | { mode: 'editing'; id: string; form: InlineEditForm; erro: string | null; salvando: boolean }
  | { mode: 'confirming'; id: string }

type EditAction =
  | { type: 'OPEN_EDIT'; id: string; form: InlineEditForm }
  | { type: 'UPDATE_FORM'; patch: Partial<InlineEditForm> }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_ERROR'; message: string }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'OPEN_CONFIRM'; id: string }
  | { type: 'CANCEL_CONFIRM' }

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case 'OPEN_EDIT':
      return { mode: 'editing', id: action.id, form: action.form, erro: null, salvando: false }
    case 'UPDATE_FORM':
      if (state.mode !== 'editing') return state
      return { ...state, form: { ...state.form, ...action.patch } }
    case 'SAVE_START':
      if (state.mode !== 'editing') return state
      return { ...state, salvando: true, erro: null }
    case 'SAVE_ERROR':
      if (state.mode !== 'editing') return state
      return { ...state, salvando: false, erro: action.message }
    case 'SAVE_SUCCESS':
      return { mode: 'idle' }
    case 'CANCEL_EDIT':
      return { mode: 'idle' }
    case 'OPEN_CONFIRM':
      return { mode: 'confirming', id: action.id }
    case 'CANCEL_CONFIRM':
      return { mode: 'idle' }
    default:
      return state
  }
}

export function useInlineEdit() {
  const [editState, editDispatch] = useReducer(editReducer, { mode: 'idle' })
  return { editState, editDispatch }
}
