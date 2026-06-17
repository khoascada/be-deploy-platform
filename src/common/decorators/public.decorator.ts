import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Gắn metadata 'isPublic: true' lên route — JwtAuthGuard đọc key này để bỏ qua auth
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
