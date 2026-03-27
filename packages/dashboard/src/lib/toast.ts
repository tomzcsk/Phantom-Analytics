import Swal from 'sweetalert2'

const baseConfig = {
  background: '#1a1d27',
  color: '#f1f5fd',
  confirmButtonColor: '#4f8ef7',
  cancelButtonColor: '#2e3147',
  customClass: {
    popup: 'swal-phantom',
  },
}

export function toastSuccess(title: string, text?: string) {
  return Swal.fire({
    ...baseConfig,
    icon: 'success',
    title,
    text,
    timer: 2000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
  })
}

export function toastError(title: string, text?: string) {
  return Swal.fire({
    ...baseConfig,
    icon: 'error',
    title,
    text,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
  })
}

export function alertSuccess(title: string, text?: string) {
  return Swal.fire({
    ...baseConfig,
    icon: 'success',
    title,
    text,
  })
}

export function alertError(title: string, text?: string) {
  return Swal.fire({
    ...baseConfig,
    icon: 'error',
    title,
    text,
  })
}

export function alertConfirm(title: string, text: string, confirmLabel = 'ยืนยัน', danger = false) {
  return Swal.fire({
    ...baseConfig,
    icon: danger ? 'warning' : 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: danger ? '#f75252' : '#4f8ef7',
  })
}
