# Pipes trong NestJS

## Ý ngắn gọn

Pipe là lớp trung gian chạy trước khi controller method thực sự được gọi.

Nó thường chạy trên từng argument của method, ví dụ argument lấy từ:

- `@Body()`
- `@Param()`
- `@Query()`

## Pipe dùng để làm gì

Pipe thường làm 2 việc chính:

- `validate`: kiểm tra dữ liệu đầu vào có đúng format không
- `transform`: đổi dữ liệu đầu vào sang dạng mình muốn dùng

Ví dụ:

- string `"123"` -> number `123`
- request body -> dữ liệu đã được validate

## Khi nào pipe chạy

Ví dụ controller:

```ts
async login(@Body() dto: LoginDto) {}
```

Flow ngắn gọn:

1. Nest lấy dữ liệu từ request
2. pipe chạy trên argument đó
3. nếu hợp lệ thì controller method mới được gọi
4. nếu không hợp lệ thì ném lỗi luôn, method không chạy

## Ví dụ trong repo này

Repo đang dùng global pipe ở `src/main.ts`:

```ts
app.useGlobalPipes(new ZodValidationPipe());
```

Nghĩa là trước khi vào controller, Nest sẽ cho pipe này xử lý các argument liên quan.

Với:

```ts
@Body() dto: LoginDto
```

thì `ZodValidationPipe` sẽ validate `req.body` theo schema gắn trong `LoginDto`.

## Kết luận ngắn

- pipe chạy trước controller method
- thường áp vào từng argument
- hay dùng để validate và transform input
- nếu pipe fail thì request bị chặn trước khi vào service
