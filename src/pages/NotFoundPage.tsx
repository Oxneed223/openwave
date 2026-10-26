import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../components/Common";

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        icon={Compass}
        title="Страница не найдена"
        text="Похоже, такой страницы нет. Вернитесь на главную и продолжите слушать."
        action={
          <Link to="/" className="btn primary">
            На главную
          </Link>
        }
      />
    </div>
  );
}
