import { notFound } from "next/navigation";
import { getCourse } from "@/lib/learning/courses";
import CourseView from "@/components/learning/CourseView";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const course = getCourse(topicId);

  if (!course) notFound();

  return (
    <main className="flex flex-1 flex-col items-center">
      <CourseView course={course} />
    </main>
  );
}
