# Swagger — Security Decorators

Nhóm này kiểm soát **Swagger UI có gửi token kèm request hay không**. Không ảnh hưởng runtime — chỉ là metadata cho Swagger.

---

## Setup trong `main.ts`

Trước khi dùng các decorator bên dưới, phải đăng ký security scheme trong `DocumentBuilder`:

```ts
const config = new DocumentBuilder()
  .addBearerAuth()   // đăng ký scheme tên "bearer"
  .build();
```

---

## `@ApiBearerAuth`

Báo cho Swagger UI biết route này cần Bearer token. Khi user click **Authorize** và nhập token, Swagger sẽ tự động đính kèm `Authorization: Bearer <token>` vào request của route có decorator này.

```ts
// Đặt ở class → áp dụng cho tất cả routes trong controller
@ApiBearerAuth()
@Controller('users')
export class UserController { ... }

// Hoặc đặt ở từng method
@ApiBearerAuth()
@Get()
findAll() { ... }
```

> **Hay nhầm:** Thiếu `@ApiBearerAuth()` → Swagger không gửi token → 401, dù đã nhấn Authorize. Postman vẫn hoạt động vì bạn tự thêm header.

---

## `@ApiSecurity`

Tổng quát hơn `@ApiBearerAuth`, dùng khi scheme không phải Bearer (vd: API key).

```ts
@ApiSecurity('api-key')
@Get()
findAll() { ... }
```

Tên phải khớp với scheme đã đăng ký trong `DocumentBuilder.addApiKey(...)`.
