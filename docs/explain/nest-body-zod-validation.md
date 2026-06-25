# `@Body()` + `LoginDto` + Zod validate trong repo này

## Ý chính

`@Body()` chỉ có nhiệm vụ lấy dữ liệu từ `req.body`.

NestJS không tự hiểu rule Zod chỉ vì parameter được gõ kiểu `LoginDto`.
Validation xảy ra vì repo này đang dùng thêm:

- `createZodDto(loginSchema)`
- `ZodValidationPipe()` global

## Flow thực tế

Trong controller:

```ts
async login(@Body() dto: LoginDto) {}
```

Nest làm theo flow này:

1. `@Body()` lấy dữ liệu từ `req.body`
2. gán dữ liệu đó vào parameter `dto`
3. thấy type của parameter là `LoginDto`
4. `LoginDto` được tạo từ `createZodDto(loginSchema)`
5. `ZodValidationPipe` dùng schema đó để validate request body

## Các file liên quan

- `src/features/auth/auth.controller.ts`
- `src/features/auth/dto/login.dto.ts`
- `src/features/auth/schemas/auth.schema.ts`
- `src/main.ts`

## Mapping trong repo

`LoginDto`:

```ts
export class LoginDto extends createZodDto(loginSchema) {}
```

`loginSchema`:

```ts
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
});
```

Global pipe:

```ts
app.useGlobalPipes(new ZodValidationPipe());
```

## Kết luận ngắn

- `@Body()` = lấy `req.body`
- `LoginDto` = cầu nối tới `loginSchema`
- `ZodValidationPipe` = nơi thực sự chạy validation

Nếu chỉ có:

```ts
@Body() dto: { email: string; password: string }
```

thì sẽ không có Zod validation tự động.
