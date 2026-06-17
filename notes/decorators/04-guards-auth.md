# Guard & Auth Decorators

Nhóm này kiểm soát **ai được phép gọi route**, và lấy thông tin user từ JWT.

---

## `@Public` *(custom decorator)*

Đánh dấu route không cần xác thực. JwtAuthGuard kiểm tra decorator này trước khi verify token.

```ts
@Public()
@Get()
findAll() { ... }  // ai cũng gọi được, không cần token
```

Cách implement:
```ts
export const Public = () => SetMetadata('isPublic', true);
```

JwtAuthGuard đọc metadata `isPublic`, nếu `true` thì bỏ qua verify.

---

## `@Roles` *(custom decorator)*

Chỉ định role nào được phép truy cập route. RolesGuard đọc metadata này và so với `user.role` trong JWT.

```ts
@Roles('ADMIN')
@Delete(':id')
remove() { ... }  // chỉ ADMIN mới xóa được
```

Cách implement:
```ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

---

## `@CurrentUser` *(custom decorator)*

Lấy user object đã được JwtAuthGuard gắn vào request sau khi verify token.

```ts
// Lấy toàn bộ user
@Get('me')
getMe(@CurrentUser() user: AuthUser) {
  return user;
}

// Lấy một field cụ thể
@Post()
create(@CurrentUser('id') userId: number) { ... }
```

Cách implement:
```ts
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return field ? req.user[field] : req.user;
  },
);
```

---

## Flow tổng quan

```
Request
  ↓
JwtAuthGuard     → verify JWT, gắn user vào req.user
  ↓                 nếu @Public() thì bỏ qua
RolesGuard       → đọc @Roles(), so với req.user.role
  ↓                 nếu không có @Roles() thì cho qua
Handler          → @CurrentUser() đọc req.user
```
