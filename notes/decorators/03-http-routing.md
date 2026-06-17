# HTTP & Routing Decorators

Nhóm này xử lý **định nghĩa route và lấy dữ liệu từ request**.

---

## `@Controller`

Đánh dấu class là một controller và định nghĩa route prefix.

```ts
@Controller('users')        // tất cả routes trong class có prefix /users
export class UserController { ... }
```

---

## HTTP Method Decorators

Gắn method handler vào HTTP verb + path.

```ts
@Get()           // GET /users
@Get(':id')      // GET /users/:id
@Post()          // POST /users
@Patch(':id')    // PATCH /users/:id
@Put(':id')      // PUT /users/:id
@Delete(':id')   // DELETE /users/:id
```

---

## `@Param` / `@Query` / `@Body`

Lấy dữ liệu từ các phần khác nhau của request.

```ts
// URL param: GET /users/42
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) { ... }

// Query string: GET /users?page=1&limit=10
@Get()
findAll(@Query() pagination: PaginationDto) { ... }

// Request body: POST /users
@Post()
create(@Body() dto: CreateUserDto) { ... }
```

| Decorator | Lấy từ | Ví dụ URL |
|---|---|---|
| `@Param('id')` | `/users/:id` | `/users/42` |
| `@Query()` | `?key=value` | `/users?page=1` |
| `@Body()` | Request body | JSON payload |

---

## `@HttpCode`

Override status code mặc định của response. NestJS mặc định trả 200 cho GET/PATCH/DELETE, 201 cho POST.

```ts
@HttpCode(HttpStatus.NO_CONTENT)  // 204
@Delete(':id')
remove() { ... }

@HttpCode(HttpStatus.OK)          // 200 (override POST default 201)
@Post('login')
login() { ... }
```

---

## `@UseGuards`

Gắn một hoặc nhiều Guard vào route/controller. Guard chạy trước handler, trả `true` thì tiếp tục, `false` thì throw 403.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController { ... }
```

Đặt ở class → áp dụng cho tất cả routes. Đặt ở method → chỉ route đó.
