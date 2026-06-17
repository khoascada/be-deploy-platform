# Swagger — Schema & Response Decorators

Nhóm này dùng để **mô tả shape của data** trong Swagger UI (request body, response body, field types).

---

## `@ApiProperty`

Đánh dấu một field trong DTO class để Swagger biết field đó tồn tại và có kiểu gì.

```ts
export class UserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'John', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] })
  role!: string;
}
```

| Option | Ý nghĩa |
|---|---|
| `example` | Giá trị ví dụ hiển thị trong Swagger |
| `nullable: true` | Cho biết field có thể là `null` |
| `enum` | Giới hạn các giá trị hợp lệ |
| `type` | Chỉ định kiểu khi TypeScript không tự infer được (vd: nested object) |

> Nếu không có `@ApiProperty`, Swagger sẽ không biết field đó tồn tại — class sẽ hiển thị là `{}`.

---

## `@ApiExtraModels`

Đăng ký thêm model vào Swagger schema mà không gắn trực tiếp vào route nào. Cần thiết khi dùng `$ref` (generic wrapper).

```ts
@ApiExtraModels(UserDto)
@ApiOkResponse({
  schema: {
    properties: {
      data: { $ref: getSchemaPath(UserDto) },
    },
  },
})
findAll() { ... }
```

---

## `@ApiOkResponse` / `@ApiCreatedResponse`

Mô tả shape của response trả về cho từng route.

```ts
@ApiOkResponse({ type: UserDto })
findOne() { ... }

@ApiCreatedResponse({ type: ProductDto })
create() { ... }
```

Dùng `type` cho object đơn, dùng `schema` + `$ref` cho generic wrapper (như `{ success, data }`).

---

## `@ApiTags`

Nhóm các route vào cùng một section trong Swagger UI.

```ts
@ApiTags('users')
@Controller('users')
export class UserController { ... }
```
