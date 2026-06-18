---
name: api-and-interface-design
description: Hướng dẫn thiết kế API và interface ổn định. Dùng khi thiết kế API, ranh giới module, hoặc bất kỳ public interface nào. Dùng khi tạo REST hoặc GraphQL endpoint, định nghĩa contract type giữa các module, hoặc thiết lập boundary giữa frontend và backend.
---

# Thiết Kế API Và Interface

## Tổng Quan

Hãy thiết kế các interface ổn định, có tài liệu rõ ràng, và khó bị dùng sai. Interface tốt khiến việc đúng trở nên dễ và việc sai trở nên khó. Điều này áp dụng cho REST API, GraphQL schema, boundary giữa module, props của component, và mọi bề mặt nơi một phần code giao tiếp với phần khác.

## Khi Nào Dùng

- Thiết kế endpoint API mới
- Định nghĩa boundary hoặc contract giữa các module / team
- Tạo props interface cho component
- Thiết kế database schema có ảnh hưởng đến shape của API
- Thay đổi public interface hiện có

## Các Nguyên Tắc Cốt Lõi

### Hyrum's Law

> Với đủ nhiều người dùng API, mọi hành vi có thể quan sát được của hệ thống rồi cũng sẽ bị ai đó phụ thuộc vào, bất kể bạn có hứa nó là contract hay không.

Điều đó có nghĩa là: mọi hành vi public, kể cả quirks chưa được ghi tài liệu, text lỗi, timing hay ordering, đều có thể biến thành contract ngầm khi người dùng dựa vào nó.

Hệ quả thiết kế:

- **Hãy chủ đích với những gì bạn phơi ra.** Mọi thứ người dùng nhìn thấy đều có thể trở thành cam kết.
- **Đừng làm lộ chi tiết implementation.** Nếu người dùng quan sát được, họ sẽ phụ thuộc vào nó.
- **Tính chuyện deprecation ngay từ lúc thiết kế.**
- **Test chưa đủ.** Dù có contract test tốt, thay đổi tưởng là "an toàn" vẫn có thể làm hỏng người dùng đang dựa vào hành vi không được ghi tài liệu.

### Quy Tắc Một Phiên Bản

Tránh ép consumer phải chọn giữa nhiều version của cùng một dependency hoặc cùng một API. Diamond dependency là nguồn gốc của rất nhiều đau đớn. Hãy thiết kế theo tinh thần chỉ có một version sống tại một thời điểm: mở rộng thay vì fork.

### 1. Contract Trước

Định nghĩa interface trước khi implement. Contract là spec; implementation đi theo sau.

```typescript
interface TaskAPI {
  createTask(input: CreateTaskInput): Promise<Task>;
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;
  getTask(id: string): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}
```

### 2. Error Semantics Phải Nhất Quán

Chọn một chiến lược lỗi và dùng nó ở khắp nơi:

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

Map status code thống nhất:

- `400` -> client gửi dữ liệu sai format
- `401` -> chưa xác thực
- `403` -> đã xác thực nhưng không có quyền
- `404` -> không tìm thấy resource
- `409` -> conflict như duplicate hoặc version mismatch
- `422` -> validation fail về mặt ngữ nghĩa
- `500` -> lỗi phía server, không lộ nội bộ

**Đừng trộn pattern.** Nếu endpoint này throw, endpoint kia trả `null`, endpoint khác lại trả `{ error }`, thì consumer không thể dự đoán interface.

### 3. Validate Ở Boundary

Tin code nội bộ, nhưng validate ở ranh giới nơi input ngoài đi vào:

```typescript
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

Validate nên nằm ở:

- route handler / controller
- form submit handler
- parser cho response từ external service
- nơi load environment variables

Validate **không** nên nằm ở:

- giữa các hàm nội bộ đã cùng type contract
- utility function được gọi từ code đã validate
- dữ liệu vừa đọc ra từ chính database của bạn

> Response của third-party API là dữ liệu không đáng tin. Luôn validate shape và content của nó trước khi dùng vào logic hoặc render.

### 4. Ưu Tiên Bổ Sung Hơn Là Phá Vỡ

Mở rộng interface mà không làm gãy consumer hiện có:

```typescript
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
}
```

Tệ là xóa field hoặc đổi type field hiện có.

### 5. Naming Dễ Đoán

| Pattern | Convention | Ví dụ |
|---------|-----------|---------|
| REST endpoints | Danh từ số nhiều, không động từ | `GET /api/tasks`, `POST /api/tasks` |
| Query params | camelCase | `?sortBy=createdAt&pageSize=20` |
| Response fields | camelCase | `{ createdAt, updatedAt, taskId }` |
| Boolean fields | tiền tố is/has/can | `isComplete`, `hasAttachments` |
| Enum values | UPPER_SNAKE | `"IN_PROGRESS"`, `"COMPLETED"` |

## Pattern REST API

### Thiết Kế Resource

```
GET    /api/tasks              -> List tasks
POST   /api/tasks              -> Create task
GET    /api/tasks/:id          -> Lấy một task
PATCH  /api/tasks/:id          -> Update một phần
DELETE /api/tasks/:id          -> Xóa task

GET    /api/tasks/:id/comments -> List comment của task
POST   /api/tasks/:id/comments -> Thêm comment cho task
```

### Pagination

Endpoint list phải có pagination:

```typescript
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

### Filtering

Filter đi qua query parameters:

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

### Partial Update Với PATCH

Chỉ update field nào được truyền vào:

```typescript
PATCH /api/tasks/123
{ "title": "Updated title" }
```

## Pattern Interface TypeScript

### Dùng Discriminated Union Cho Biến Thể

```typescript
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };
```

### Tách Input Và Output

```typescript
interface CreateTaskInput {
  title: string;
  description?: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

### Dùng Branded Type Cho ID

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };
```

Giúp tránh truyền nhầm `UserId` vào chỗ cần `TaskId`.

## Những Lý Do Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "API sẽ document sau" | Type chính là tài liệu. Hãy định nghĩa trước. |
| "Giờ chưa cần pagination" | Sẽ cần ngay khi có 100+ items. |
| "PATCH phức tạp quá, dùng PUT đi" | PUT đòi full object mỗi lần. PATCH mới là cái client thật sự muốn. |
| "Khi nào cần mới version API" | Breaking change không version sẽ làm gãy consumer. |
| "Không ai dùng hành vi undocumented đâu" | Hyrum's Law nói điều ngược lại. |
| "Giữ hai version song song cũng được" | Nhiều version nhân đôi chi phí và tạo diamond dependency. |
| "Internal API không cần contract" | Internal consumer vẫn là consumer. |

## Red Flags

- Endpoint trả shape khác nhau tùy điều kiện
- Error format không nhất quán
- Validation rải rác trong code nội bộ thay vì ở boundary
- Breaking change ở field cũ
- Endpoint list không có pagination
- URL REST chứa động từ như `/api/createTask`
- Dùng response third-party mà không validate

## Verification

Sau khi thiết kế API:

- [ ] Mỗi endpoint có input/output schema typed rõ ràng
- [ ] Error response theo một format thống nhất
- [ ] Validation chỉ diễn ra ở boundary
- [ ] Endpoint list hỗ trợ pagination
- [ ] Field mới mang tính additive và optional khi cần tương thích ngược
- [ ] Naming nhất quán trên toàn bộ endpoint
- [ ] Docs hoặc types của API được commit cùng implementation
